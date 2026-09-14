import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { book, input } from "./fixtures";

const mocks = vi.hoisted(() => {
  vi.stubEnv("OPENAI_API_KEY", "test-only-no-network");
  return { auth: vi.fn(), chat: vi.fn(), image: vi.fn() };
});
vi.mock("server-only", () => ({}));
vi.mock("@/app/api/server-auth", () => ({ requireServerUser: mocks.auth }));
vi.mock("openai", () => ({
  OpenAI: class {
    chat = { completions: { create: mocks.chat } };
    images = { generate: mocks.image };
  },
}));
import {
  generatePicturebookStart,
  generatePicturebookEnding,
  generatePicturebookPageImage,
} from "../src/app/api/langchain";

function startResponse() {
  const draft = book();
  return {
    title: draft.title,
    pages: draft.pages,
    choice: draft.choice,
    safetyNotes: [] as string[],
  };
}
function response(value: unknown, finish_reason = "stop") {
  return {
    choices: [{ message: { content: JSON.stringify(value) }, finish_reason }],
  };
}
const imageInput = {
  title: "작은 용기",
  childName: "민준",
  pageNumber: 1,
  textKo: "작은 손을 조용히 내밀었어요.",
  imagePrompt: "Warm bedtime illustration",
};
beforeEach(() => {
  mocks.auth.mockReset().mockResolvedValue({ user: { id: "owner" } });
  mocks.chat.mockReset().mockResolvedValue(response(startResponse()));
  mocks.image.mockReset().mockResolvedValue({ data: [{ b64_json: "image" }] });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());
afterAll(() => vi.unstubAllEnvs());

describe("bounded story model output", () => {
  it("preserves a valid four-page story and context-specific action wording", async () => {
    const output = startResponse();
    output.choice.options[0].labelKo = "양치를 해봐요";
    output.choice.options[0].resolutionHint =
      "칫솔을 입에 대고 앞니 한 개를 닦습니다.";
    mocks.chat.mockResolvedValue(response(output));
    const result = await generatePicturebookStart(input, "token");
    expect(result.status).toBe("choice-ready");
    expect(result.pages).toHaveLength(4);
    expect(result.choice.options[0].labelKo).toBe("양치를 해봐요");
    expect(result.choice.options[0].resolutionHint).toContain("칫솔");
    expect(mocks.chat).toHaveBeenCalledTimes(2);
    // Leave time for auth and persistence under the hosting plan's 60s ceiling.
    expect(mocks.chat.mock.calls.map(call => call[1].timeout)).toEqual([35000, 15000]);
  });
  it.each([
    [
      "missing page text",
      (value: any) => {
        delete value.pages[0].textKo;
      },
    ],
    [
      "missing image prompt",
      (value: any) => {
        delete value.pages[0].imagePrompt;
      },
    ],
    [
      "blank page text",
      (value: any) => {
        value.pages[0].textKo = "   ";
      },
    ],
    [
      "oversized page text",
      (value: any) => {
        value.pages[0].textKo = "가".repeat(4001);
      },
    ],
    [
      "oversized image prompt",
      (value: any) => {
        value.pages[0].imagePrompt = "x".repeat(2001);
      },
    ],
    [
      "oversized title",
      (value: any) => {
        value.title = "가".repeat(201);
      },
    ],
    [
      "missing choice label",
      (value: any) => {
        delete value.choice.options[0].labelKo;
      },
    ],
    [
      "empty resolution",
      (value: any) => {
        value.choice.options[0].resolutionHint = "";
      },
    ],
    [
      "malformed notes",
      (value: any) => {
        value.qualityNotes = [42];
      },
    ],
    [
      "too many notes",
      (value: any) => {
        value.safetyNotes = Array(51).fill("메모");
      },
    ],
    [
      "oversized note",
      (value: any) => {
        value.revisionNotes = ["가".repeat(501)];
      },
    ],
    [
      "blocked choice",
      (value: any) => {
        value.choice.options[0].labelKo = "장난감을 계속 빼앗아요";
      },
    ],
  ] as const)(
    "rejects %s instead of manufacturing a paid fallback book",
    async (_, mutate) => {
      const output = startResponse();
      mutate(output);
      mocks.chat.mockResolvedValue(response(output));
      await expect(generatePicturebookStart(input, "token")).rejects.toThrow(
        "이야기를 만들지 못했어요",
      );
      expect(mocks.chat).toHaveBeenCalledTimes(1);
    },
  );
  it("retains a valid first draft when optional quality rewriting is malformed", async () => {
    mocks.chat
      .mockResolvedValueOnce(response(startResponse()))
      .mockResolvedValueOnce(response({ pages: [] }));
    const result = await generatePicturebookStart(input, "token");
    expect(result.pages).toEqual(book().pages);
    expect(result.qualityNotes).toContain("quality-rewrite-fallback-used");
  });
  it("rejects a truncated model completion even if its JSON happens to parse", async () => {
    mocks.chat.mockResolvedValue(response(startResponse(), "length"));
    await expect(generatePicturebookStart(input, "token")).rejects.toThrow(
      "이야기를 만들지 못했어요",
    );
    expect(mocks.chat).toHaveBeenCalledTimes(1);
  });
  it("trims parent input before using it in the model prompt", async () => {
    await generatePicturebookStart(
      { ...input, childName: "  민준  ", situation: `  ${input.situation}  ` },
      "token",
    );
    const prompt = mocks.chat.mock.calls[0][0].messages[1].content;
    expect(prompt).toContain("아이 이름: 민준\n");
    expect(prompt).not.toContain("  민준  ");
  });
  it("rejects invalid input before sending any model request", async () => {
    await expect(
      generatePicturebookStart({ ...input, childAge: "2" }, "token"),
    ).rejects.toThrow("3~12세");
    expect(mocks.chat).not.toHaveBeenCalled();
  });
});

describe("validated endings", () => {
  it("preserves the original opening and chosen action when completing the book", async () => {
    const opening = book();
    mocks.chat.mockResolvedValue(
      response({ pages: book("complete").pages.slice(4), safetyNotes: [] }),
    );
    const result = await generatePicturebookEnding(opening, "B", "token");
    expect(result.status).toBe("complete");
    expect(result.selectedChoiceId).toBe("B");
    expect(result.pages.slice(0, 4)).toEqual(opening.pages);
    expect(result.pages).toHaveLength(8);
    expect(result.pages[7].emotionalBeat).toBe("calm-close");
    expect(opening.status).toBe("choice-ready");
  });
  it("does not mark missing ending text complete", async () => {
    mocks.chat.mockResolvedValue(response({ pages: [{}, {}, {}, {}] }));
    await expect(
      generatePicturebookEnding(book(), "A", "token"),
    ).rejects.toThrow("결말을 만들지 못했어요");
    expect(mocks.chat).toHaveBeenCalledTimes(1);
  });
  it("keeps a valid first ending if rewriting introduces another choice", async () => {
    mocks.chat
      .mockResolvedValueOnce(
        response({ pages: book("complete").pages.slice(4) }),
      )
      .mockResolvedValueOnce(
        response({ pages: book("complete").pages.slice(4), choice: {} }),
      );
    const result = await generatePicturebookEnding(book(), "A", "token");
    expect(result.status).toBe("complete");
    expect(result.qualityNotes).toContain(
      "ending-quality-rewrite-fallback-used",
    );
  });
});

describe("provider failures safe for server action results", () => {
  it.each(["credit_balance_exhausted", "insufficient_quota"])(
    "classifies upstream %s without exposing provider payloads",
    async code => {
      mocks.chat.mockRejectedValue(
        Object.assign(new Error("sensitive upstream detail"), {
          status: 429,
          code,
        }),
      );
      await expect(
        generatePicturebookEnding(book(), "A", "token"),
      ).rejects.toMatchObject({
        message:
          "이야기 생성 서비스의 이용 한도가 소진됐어요. 운영팀에 문의해주세요.",
        retryable: false,
      });
    },
  );
  it.each([401, 403])(
    "marks upstream authorization status %s as a service issue",
    async status => {
      mocks.chat.mockRejectedValue(
        Object.assign(new Error("provider secret detail"), { status }),
      );
      await expect(
        generatePicturebookStart(input, "token"),
      ).rejects.toMatchObject({
        message:
          "이야기 생성 서비스에 연결할 수 없어요. 운영팀에 문의해주세요.",
        retryable: false,
      });
    },
  );
  it("keeps transient provider rate limiting retryable", async () => {
    mocks.chat.mockRejectedValue(
      Object.assign(new Error("provider detail"), {
        status: 429,
        code: "rate_limit_exceeded",
      }),
    );
    await expect(
      generatePicturebookStart(input, "token"),
    ).rejects.toMatchObject({
      retryable: true,
      message: expect.stringContaining("요청이 몰리고"),
    });
  });
  it("classifies image credit exhaustion so its queue can stop", async () => {
    mocks.image.mockRejectedValue(
      Object.assign(new Error("provider detail"), {
        status: 429,
        type: "insufficient_quota",
      }),
    );
    await expect(
      generatePicturebookPageImage(imageInput, "token"),
    ).rejects.toMatchObject({
      retryable: false,
      message: expect.stringContaining("운영팀"),
    });
  });
  it.each([
    null,
    { ...imageInput, textKo: " " },
    { ...imageInput, pageNumber: 9 },
  ])(
    "rejects an invalid image request before calling the provider",
    async value => {
      await expect(
        generatePicturebookPageImage(value as typeof imageInput, "token"),
      ).rejects.toThrow("그림 요청을 확인해주세요");
      expect(mocks.image).not.toHaveBeenCalled();
    },
  );
});
