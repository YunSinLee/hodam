import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { PicturebookDraft } from "../src/app/types/openai";
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

const storyGuide = {
  coreConflict: "유치원 문 앞에서 들어가기 망설여요.",
  characters: ["민준", "엄마", "유치원 친구"],
  keyObject: "작은 호랑이 인형",
  resolutionGoal: "인형을 안고 친구에게 한 걸음 다가가요.",
  visualStyle:
    "A five-year-old child with short black hair, a yellow cardigan and a small orange tiger plush; soft gouache.",
};
function startResponse() {
  const draft = book();
  return {
    title: draft.title,
    pages: draft.pages,
    choice: draft.choice,
    storyGuide: { ...storyGuide, characters: [...storyGuide.characters] },
    safetyNotes: [] as string[],
  };
}
function endingResponse() {
  return { pages: book("complete").pages.slice(4), safetyNotes: [] };
}
function response(value: unknown, finish_reason = "stop") {
  return {
    choices: [{ message: { content: JSON.stringify(value) }, finish_reason }],
  };
}

type ReviewRequest = {
  messages: { role: string; content: string }[];
};
type ReviewMaterial = {
  stage: "start" | "ending";
  input: Pick<
    PicturebookDraft,
    "childName" | "ageBand" | "situation" | "lesson" | "interests" | "tone"
  >;
  title: string;
  choicePrompt: string;
  selectedChoiceId?: PicturebookDraft["selectedChoiceId"];
  sources: Record<string, string>;
};
const criteria = [
  "input_fidelity",
  "choice_integrity",
  "continuity",
  "language",
  "read_aloud",
  "visual_consistency",
  "emotional_safety",
] as const;
function reviewMaterial(request: ReviewRequest): ReviewMaterial {
  const prompt = request.messages.find(
    message => message.role === "user",
  )!.content;
  return JSON.parse(prompt.split("검수자료:\n")[1]);
}
function approvedReview(request: ReviewRequest) {
  const { sources } = reviewMaterial(request);
  return {
    checks: criteria.map(criterion => {
      const source = criterion === "visual_consistency" ? "image:1" : "page:1";
      return {
        criterion,
        passed: true,
        reason: "제시된 장면에서 확인했어요.",
        evidence: [{ source, quote: sources[source].slice(0, 80) }],
        fix: "",
      };
    }),
  };
}
function rejectedReview(request: ReviewRequest) {
  const review = approvedReview(request);
  review.checks[3].passed = false;
  review.checks[3].reason = "장면이 설명으로만 제시되어 낭독하기 어색해요.";
  review.checks[3].fix =
    "지적한 쪽의 추상적인 설명을 손과 인형의 움직임으로 고쳐주세요.";
  return review;
}
function approveNextReview() {
  mocks.chat.mockImplementationOnce(async request =>
    response(approvedReview(request)),
  );
}
function rejectNextReview() {
  mocks.chat.mockImplementationOnce(async request =>
    response(rejectedReview(request)),
  );
}
function rejectNextEmotionalSafetyReview() {
  mocks.chat.mockImplementationOnce(async request => {
    const review = approvedReview(request);
    const check = review.checks.find(
      item => item.criterion === "emotional_safety",
    )!;
    check.passed = false;
    check.reason =
      "다른 아이의 장난감을 빼앗는 행동을 좋은 해결책으로 제시해요.";
    check.evidence = [
      {
        source: "choice:A",
        quote: reviewMaterial(request).sources["choice:A"],
      },
    ];
    check.fix =
      "장난감을 빼앗는 대신 함께 써도 되는지 묻는 행동으로 바꿔주세요.";
    return response(review);
  });
}
const imageInput = {
  title: "작은 용기",
  childName: "민준",
  pageNumber: 1,
  textKo: "작은 손을 조용히 내밀었어요.",
  imagePrompt: "Warm bedtime illustration",
};
beforeEach(() => {
  vi.stubEnv("OPENAI_STORY_MODEL", "");
  vi.stubEnv("OPENAI_STORY_REVIEW_MODEL", "");
  mocks.auth.mockReset().mockResolvedValue({ user: { id: "owner" } });
  mocks.chat.mockReset();
  mocks.image.mockReset().mockResolvedValue({ data: [{ b64_json: "image" }] });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());
afterAll(() => vi.unstubAllEnvs());

describe("reviewed picturebook generation", () => {
  it("publishes an approved draft without rewriting its context-specific action", async () => {
    const output = startResponse();
    output.choice.options[0].labelKo = "양치를 해봐요";
    output.choice.options[0].resolutionHint =
      "칫솔을 입에 대고 앞니 한 개를 닦습니다.";
    mocks.chat.mockResolvedValueOnce(response(output));
    approveNextReview();
    const result = await generatePicturebookStart(input, "token");
    expect(result.status).toBe("choice-ready");
    expect(result.pages).toEqual(output.pages);
    expect(result.choice).toEqual(output.choice);
    expect(result.storyGuide).toEqual(output.storyGuide);
    expect(mocks.chat).toHaveBeenCalledTimes(2);
    const [writer, editor] = mocks.chat.mock.calls;
    expect(writer[0].model).toBe("gpt-5.4-2026-03-05");
    expect(writer[0].reasoning_effort).toBe("low");
    expect(writer[0]).not.toHaveProperty("temperature");
    expect(editor[0].model).toBe("gpt-5.4-2026-03-05");
    expect(editor[0].reasoning_effort).toBe("low");
    expect(editor[0]).not.toHaveProperty("temperature");
    expect(writer[1].timeout).toBeLessThanOrEqual(18000);
    expect(editor[1].timeout).toBeLessThanOrEqual(20000);
    expect(editor[0].messages[0].content).not.toEqual(
      writer[0].messages[0].content,
    );
  });
  it("does not change repair or review models when only the draft writer is overridden", async () => {
    vi.stubEnv("OPENAI_STORY_MODEL", "gpt-4.1-mini-2025-04-14");
    mocks.chat.mockResolvedValueOnce(response(startResponse()));
    rejectNextReview();
    mocks.chat.mockResolvedValueOnce(
      response({ pages: [startResponse().pages[0]] }),
    );
    approveNextReview();
    await generatePicturebookStart(input, "token");

    expect(mocks.chat.mock.calls.map(([request]) => request.model)).toEqual([
      "gpt-4.1-mini-2025-04-14",
      "gpt-5.4-2026-03-05",
      "gpt-5.4-2026-03-05",
      "gpt-5.4-2026-03-05",
    ]);
    expect(mocks.chat.mock.calls[0][0].temperature).toBe(0.75);
    expect(mocks.chat.mock.calls[0][0]).not.toHaveProperty("reasoning_effort");
    for (const index of [1, 2, 3]) {
      expect(mocks.chat.mock.calls[index][0].reasoning_effort).toBe("low");
      expect(mocks.chat.mock.calls[index][0]).not.toHaveProperty("temperature");
    }
  });
  it.each([
    ["gpt-4.1-2025-04-14", false],
    ["gpt-5.4", true],
  ] as const)(
    "uses review override %s for repair and both reviews without changing the draft writer",
    async (model, reasoningModel) => {
      vi.stubEnv("OPENAI_STORY_REVIEW_MODEL", model);
      mocks.chat.mockResolvedValueOnce(response(startResponse()));
      rejectNextReview();
      mocks.chat.mockResolvedValueOnce(
        response({ pages: [startResponse().pages[0]] }),
      );
      approveNextReview();
      await generatePicturebookStart(input, "token");

      const [writer] = mocks.chat.mock.calls;
      expect(writer[0].model).toBe("gpt-5.4-2026-03-05");
      expect(writer[0].reasoning_effort).toBe("low");
      expect(writer[0]).not.toHaveProperty("temperature");
      for (const index of [1, 2, 3]) {
        const [request, options] = mocks.chat.mock.calls[index];
        expect(request.model).toBe(model);
        if (reasoningModel) {
          expect(request.reasoning_effort).toBe("low");
          expect(request).not.toHaveProperty("temperature");
        } else {
          expect(request.temperature).toBe(index === 2 ? 0.35 : 0.1);
          expect(request).not.toHaveProperty("reasoning_effort");
        }
        expect(options.timeout).toBeLessThanOrEqual(
          index === 2 ? 18000 : 20000,
        );
      }
      expect(mocks.chat).toHaveBeenCalledTimes(4);
    },
  );
  it("also omits unsupported temperature when the writer overrides the snapshot with a GPT-5.4 alias", async () => {
    vi.stubEnv("OPENAI_STORY_MODEL", "gpt-5.4");
    mocks.chat.mockResolvedValueOnce(response(startResponse()));
    approveNextReview();
    await generatePicturebookStart(input, "token");

    const writer = mocks.chat.mock.calls[0][0];
    expect(writer.model).toBe("gpt-5.4");
    expect(writer.reasoning_effort).toBe("low");
    expect(writer).not.toHaveProperty("temperature");
  });
  it("keeps writer plans and self-assessments out of both opening reviews", async () => {
    const output = {
      ...startResponse(),
      storyGuide: {
        ...storyGuide,
        coreConflict: "계획에만 적힌 갈등은 검수 근거가 아니에요.",
        characters: ["계획에만 등장하는 조연"],
        keyObject: "계획에만 등장하는 종이 배",
        resolutionGoal: "계획 속에서만 이미 해결됐다고 주장해요.",
      },
      qualityNotes: ["작가는 모든 품질 기준을 통과했다고 주장해요."],
    };
    output.choice.options.forEach(option => {
      option.resolutionHint = `실제로 쓰이지 않은 ${option.id} 선택의 해결 계획이에요.`;
    });
    mocks.chat.mockResolvedValueOnce(response(output));
    rejectNextReview();
    mocks.chat.mockResolvedValueOnce(response({ pages: [output.pages[0]] }));
    approveNextReview();
    await generatePicturebookStart(input, "token");

    for (const index of [1, 3]) {
      const material = reviewMaterial(mocks.chat.mock.calls[index][0]);
      const serialized = JSON.stringify(material);
      expect(material).not.toHaveProperty("candidate");
      expect(material).not.toHaveProperty("pages");
      expect(material).not.toHaveProperty("storyGuide");
      expect(material.title).toBe(output.title);
      expect(material.choicePrompt).toBe(output.choice.promptKo);
      expect(material.input.situation).toBe(input.situation);
      expect(material.sources["visual-guide"]).toBe(storyGuide.visualStyle);
      for (const option of output.choice.options) {
        expect(material.sources[`choice:${option.id}`]).toBe(option.labelKo);
        expect(serialized).not.toContain(option.resolutionHint);
      }
      for (const claim of [
        output.storyGuide.coreConflict,
        ...output.storyGuide.characters,
        output.storyGuide.keyObject,
        output.storyGuide.resolutionGoal,
        ...output.qualityNotes,
      ]) {
        expect(serialized).not.toContain(claim);
      }
      expect(material.sources["page:1"]).toBe(output.pages[0].textKo);
    }
    expect(mocks.chat).toHaveBeenCalledTimes(4);
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
      "missing story guide",
      (value: any) => {
        delete value.storyGuide;
      },
    ],
    [
      "invalid story guide",
      (value: any) => {
        value.storyGuide.characters = [];
      },
    ],
  ] as const)("rejects %s before independent review", async (_, mutate) => {
    const output = startResponse();
    mutate(output);
    mocks.chat.mockResolvedValueOnce(response(output));
    await expect(generatePicturebookStart(input, "token")).rejects.toThrow(
      "이야기를 만들지 못했어요",
    );
    expect(mocks.chat).toHaveBeenCalledTimes(1);
  });
  it.each(["timeout", "invalid", "truncated"])(
    "does not publish an unchecked draft after a %s review",
    async failure => {
      mocks.chat.mockResolvedValueOnce(response(startResponse()));
      if (failure === "timeout")
        mocks.chat.mockRejectedValueOnce(new Error("review timeout"));
      else if (failure === "invalid")
        mocks.chat.mockResolvedValueOnce(response({ checks: [] }));
      else
        mocks.chat.mockImplementationOnce(async request =>
          response(approvedReview(request), "length"),
        );
      await expect(generatePicturebookStart(input, "token")).rejects.toThrow(
        "이야기를 만들지 못했어요",
      );
      expect(mocks.chat).toHaveBeenCalledTimes(2);
    },
  );
  it.each(["invented quote", "nonexistent source", "missing evidence"])(
    "rejects a passing review with %s",
    async failure => {
      mocks.chat.mockResolvedValueOnce(response(startResponse()));
      mocks.chat.mockImplementationOnce(async request => {
        const review = approvedReview(request);
        if (failure === "invented quote")
          review.checks[0].evidence[0].quote =
            "본문에 존재하지 않는 검수자의 문장이에요.";
        else if (failure === "nonexistent source")
          review.checks[0].evidence[0].source = "page:8";
        else review.checks[0].evidence = [];
        return response(review);
      });
      await expect(generatePicturebookStart(input, "token")).rejects.toThrow(
        "이야기를 만들지 못했어요",
      );
      expect(mocks.chat).toHaveBeenCalledTimes(2);
    },
  );
  it("patches only the changed page and independently reviews the corrected candidate", async () => {
    const output = startResponse();
    const changedPage = {
      ...output.pages[1],
      textKo:
        "호랑이 인형의 귀를 꼭 쥐었어요. 문틈으로 친구의 웃음이 들렸어요.",
    };
    mocks.chat.mockResolvedValueOnce(response(output));
    rejectNextReview();
    mocks.chat.mockResolvedValueOnce(response({ pages: [changedPage] }));
    approveNextReview();
    const result = await generatePicturebookStart(input, "token");
    expect(result.pages).toEqual([
      output.pages[0],
      changedPage,
      ...output.pages.slice(2),
    ]);
    expect(result.choice).toEqual(output.choice);
    expect(result.storyGuide).toEqual(output.storyGuide);
    expect(result.title).toBe(output.title);
    const secondReview = reviewMaterial(mocks.chat.mock.calls[3][0]);
    expect(secondReview.sources["page:2"]).toContain(changedPage.textKo);
    expect(secondReview.sources["page:2"]).not.toContain(
      output.pages[1].textKo,
    );
    expect(mocks.chat).toHaveBeenCalledTimes(4);
    mocks.chat.mock.calls.forEach((call, index) => {
      expect(call[1].timeout).toBeGreaterThan(0);
      expect(call[1].timeout).toBeLessThanOrEqual(
        [18000, 20000, 18000, 20000][index],
      );
    });
  });
  it("does not publish a patched draft that fails its second review", async () => {
    mocks.chat.mockResolvedValueOnce(response(startResponse()));
    rejectNextReview();
    mocks.chat.mockResolvedValueOnce(
      response({ pages: [startResponse().pages[0]] }),
    );
    rejectNextReview();
    await expect(
      generatePicturebookStart(input, "token"),
    ).rejects.toMatchObject({
      message: expect.stringContaining("충분히 다듬지 못했어요"),
      retryable: true,
    });
    expect(mocks.chat).toHaveBeenCalledTimes(4);
  });
  it("does not publish a repaired draft whose new review times out", async () => {
    mocks.chat.mockResolvedValueOnce(response(startResponse()));
    rejectNextReview();
    mocks.chat.mockResolvedValueOnce(
      response({ pages: [startResponse().pages[0]] }),
    );
    mocks.chat.mockRejectedValueOnce(new Error("second review timeout"));
    await expect(generatePicturebookStart(input, "token")).rejects.toThrow(
      "이야기를 만들지 못했어요",
    );
    expect(mocks.chat).toHaveBeenCalledTimes(4);
  });
  it.each([
    [
      "duplicate page numbers",
      { pages: [startResponse().pages[0], startResponse().pages[0]] },
    ],
    [
      "missing page number",
      {
        pages: [
          {
            textKo: "작은 호랑이 인형의 귀를 꼭 쥐었어요.",
            imagePrompt: "A child holds a tiger plush",
            emotionalBeat: "setup",
          },
        ],
      },
    ],
    ["page outside the opening", { pages: [book("complete").pages[4]] }],
    ["provider-invented status", { pages: [], status: "complete" }],
  ])("rejects a patch with %s before re-reviewing", async (_, patch) => {
    mocks.chat.mockResolvedValueOnce(response(startResponse()));
    rejectNextReview();
    mocks.chat.mockResolvedValueOnce(response(patch));
    await expect(generatePicturebookStart(input, "token")).rejects.toThrow(
      "이야기를 만들지 못했어요",
    );
    expect(mocks.chat).toHaveBeenCalledTimes(3);
  });
  it("does not start a review once the shared generation deadline is exhausted", async () => {
    let now = 100000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    mocks.chat.mockImplementationOnce(async () => {
      now += 50001;
      return response(startResponse());
    });
    await expect(
      generatePicturebookStart(input, "token"),
    ).rejects.toMatchObject({ retryable: true });
    expect(mocks.chat).toHaveBeenCalledTimes(1);
  });
  it("caps review timeout by the time remaining in the shared generation budget", async () => {
    let now = 100000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    mocks.chat.mockImplementationOnce(async () => {
      now += 45000;
      return response(startResponse());
    });
    approveNextReview();
    await generatePicturebookStart(input, "token");
    expect(mocks.chat.mock.calls[1][1].timeout).toBe(5000);
  });
  it("reduces the final review budget after drafting, review and repair consume time", async () => {
    let now = 100000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    mocks.chat.mockImplementationOnce(async () => {
      now += 15000;
      return response(startResponse());
    });
    mocks.chat.mockImplementationOnce(async request => {
      now += 14000;
      return response(rejectedReview(request));
    });
    mocks.chat.mockImplementationOnce(async () => {
      now += 18000;
      return response({ pages: [startResponse().pages[0]] });
    });
    approveNextReview();
    await generatePicturebookStart(input, "token");

    expect(mocks.chat).toHaveBeenCalledTimes(4);
    expect(mocks.chat.mock.calls.map(([, options]) => options.timeout)).toEqual(
      [18000, 20000, 18000, 3000],
    );
  });
  it("does not fall back to the old draft if a required patch times out", async () => {
    mocks.chat.mockResolvedValueOnce(response(startResponse()));
    rejectNextReview();
    mocks.chat.mockRejectedValueOnce(new Error("patch timeout"));
    await expect(generatePicturebookStart(input, "token")).rejects.toThrow(
      "이야기를 만들지 못했어요",
    );
    expect(mocks.chat).toHaveBeenCalledTimes(3);
  });
  it.each([
    "친구에게 손 내밀기",
    "손 내밀기요",
    "작게 말하기요",
    "함께 놓아보기요",
    "함께 놓아볼까요요",
  ])(
    "requires repair of malformed action %s even when the reviewer passes it",
    async label => {
      const initial = startResponse();
      initial.choice.options[0].labelKo = label;
      const choice = startResponse().choice;
      choice.options[0].labelKo = "친구에게 손을 내밀어요";
      mocks.chat.mockResolvedValueOnce(response(initial));
      approveNextReview();
      mocks.chat.mockResolvedValueOnce(response({ pages: [], choice }));
      approveNextReview();
      const result = await generatePicturebookStart(input, "token");
      expect(result.choice.options[0].labelKo).toBe("친구에게 손을 내밀어요");
      expect(result.pages).toEqual(initial.pages);
      expect(mocks.chat).toHaveBeenCalledTimes(4);
    },
  );
  it.each(["malformed", "duplicate"])(
    "does not publish %s choices still present after the single repair",
    async issue => {
      const output = startResponse();
      if (issue === "malformed")
        output.choice.options[0].labelKo = "작게 말해볼까요요";
      else output.choice.options[1].labelKo = output.choice.options[0].labelKo;
      mocks.chat.mockResolvedValueOnce(response(output));
      approveNextReview();
      mocks.chat.mockResolvedValueOnce(
        response({ pages: [], choice: output.choice }),
      );
      approveNextReview();
      await expect(
        generatePicturebookStart(input, "token"),
      ).rejects.toMatchObject({
        message: expect.stringContaining("충분히 다듬지 못했어요"),
        retryable: true,
      });
      expect(mocks.chat.mock.calls.length).toBeGreaterThanOrEqual(3);
      expect(mocks.chat.mock.calls.length).toBeLessThanOrEqual(4);
    },
  );
  it.each(["이불을 더 꽉 안아요", "손을 잡고 계속 걸어요"])(
    "allows harmless action %s after its independent contextual review passes",
    async label => {
      const output = startResponse();
      output.choice.options[0].labelKo = label;
      mocks.chat.mockResolvedValueOnce(response(output));
      approveNextReview();
      const result = await generatePicturebookStart(input, "token");
      expect(result.choice.options[0].labelKo).toBe(label);
      expect(
        reviewMaterial(mocks.chat.mock.calls[1][0]).sources["choice:A"],
      ).toBe(label);
      expect(mocks.chat).toHaveBeenCalledTimes(2);
    },
  );
  it("requires correction of an action the independent emotional safety review rejects", async () => {
    const output = startResponse();
    output.choice.options[0].labelKo = "장난감을 계속 빼앗아요";
    const correctedChoice = startResponse().choice;
    correctedChoice.options[0].labelKo = "친구에게 같이 써도 되는지 물어요";
    mocks.chat.mockResolvedValueOnce(response(output));
    rejectNextEmotionalSafetyReview();
    mocks.chat.mockResolvedValueOnce(
      response({ pages: [], choice: correctedChoice }),
    );
    approveNextReview();

    const result = await generatePicturebookStart(input, "token");
    expect(result.choice).toEqual(correctedChoice);
    expect(mocks.chat).toHaveBeenCalledTimes(4);
    expect(
      reviewMaterial(mocks.chat.mock.calls[3][0]).sources["choice:A"],
    ).toBe(correctedChoice.options[0].labelKo);
  });
  it("does not publish an emotionally unsafe action that remains after correction", async () => {
    const output = startResponse();
    output.choice.options[0].labelKo = "장난감을 계속 빼앗아요";
    mocks.chat.mockResolvedValueOnce(response(output));
    rejectNextEmotionalSafetyReview();
    mocks.chat.mockResolvedValueOnce(
      response({ pages: [], choice: output.choice }),
    );
    rejectNextEmotionalSafetyReview();

    await expect(
      generatePicturebookStart(input, "token"),
    ).rejects.toMatchObject({
      message: expect.stringContaining("충분히 다듬지 못했어요"),
      retryable: true,
    });
    expect(mocks.chat).toHaveBeenCalledTimes(4);
    expect(
      reviewMaterial(mocks.chat.mock.calls[1][0]).sources["choice:A"],
    ).toBe(output.choice.options[0].labelKo);
  });
  it("does not mistake Korean words containing 기 for nominal action endings", async () => {
    const output = startResponse();
    output.choice.options[0].labelKo = "용기가 나요";
    output.choice.options[1].labelKo = "친구와 이야기해요";
    output.choice.options[2].labelKo = "웃어요";
    mocks.chat.mockResolvedValueOnce(response(output));
    approveNextReview();
    expect((await generatePicturebookStart(input, "token")).choice).toEqual(
      output.choice,
    );
    expect(mocks.chat).toHaveBeenCalledTimes(2);
  });
  it("rejects a truncated writer completion even when its JSON parses", async () => {
    mocks.chat.mockResolvedValueOnce(response(startResponse(), "length"));
    await expect(generatePicturebookStart(input, "token")).rejects.toThrow(
      "이야기를 만들지 못했어요",
    );
    expect(mocks.chat).toHaveBeenCalledTimes(1);
  });
  it("trims parent input before the model sees it", async () => {
    mocks.chat.mockResolvedValueOnce(response(startResponse()));
    approveNextReview();
    const result = await generatePicturebookStart(
      { ...input, childName: "  민준  ", situation: `  ${input.situation}  ` },
      "token",
    );
    expect(result.childName).toBe("민준");
    expect(result.situation).toBe(input.situation);
    expect(mocks.chat.mock.calls[0][0].messages[1].content).not.toContain(
      "  민준  ",
    );
  });
  it("rejects invalid input before sending any model request", async () => {
    await expect(
      generatePicturebookStart({ ...input, childAge: "2" }, "token"),
    ).rejects.toThrow("3~12세");
    expect(mocks.chat).not.toHaveBeenCalled();
  });
});

describe("schema-constrained story drafts", () => {
  it("requests a strict opening schema with pages, choices and guide at the top level", async () => {
    mocks.chat.mockResolvedValueOnce(response(startResponse()));
    approveNextReview();
    await generatePicturebookStart(input, "token");

    const format = mocks.chat.mock.calls[0][0].response_format;
    expect(format.type).toBe("json_schema");
    expect(format.json_schema.strict).toBe(true);
    const schema = format.json_schema.schema;
    expect(schema.type).toBe("object");
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(
      expect.arrayContaining(["title", "pages", "choice", "storyGuide"]),
    );
    expect(schema.properties.pages).toMatchObject({
      type: "array",
      minItems: 4,
      maxItems: 4,
    });
    expect(schema.properties.choice.type).toBe("object");
    expect(schema.properties.storyGuide.type).toBe("object");
    expect(schema.properties.storyGuide.additionalProperties).toBe(false);
    expect(schema.properties.storyGuide.properties).not.toHaveProperty("pages");
    expect(schema.properties.storyGuide.properties).not.toHaveProperty(
      "choice",
    );
  });
  it("requests a strict ending schema that only allows pages and notes", async () => {
    mocks.chat.mockResolvedValueOnce(response(endingResponse()));
    approveNextReview();
    await generatePicturebookEnding(book(), "A", "token");

    const format = mocks.chat.mock.calls[0][0].response_format;
    expect(format.type).toBe("json_schema");
    expect(format.json_schema.strict).toBe(true);
    const schema = format.json_schema.schema;
    expect(schema.type).toBe("object");
    expect(schema.additionalProperties).toBe(false);
    expect(Object.keys(schema.properties).sort()).toEqual([
      "pages",
      "qualityNotes",
      "revisionNotes",
      "safetyNotes",
    ]);
    expect(schema.required).toEqual(expect.arrayContaining(["pages"]));
    expect(schema.properties.pages).toMatchObject({
      type: "array",
      minItems: 4,
      maxItems: 4,
    });
    for (const field of ["safetyNotes", "qualityNotes", "revisionNotes"]) {
      expect(schema.properties[field]).toMatchObject({
        type: "array",
        items: { type: "string" },
      });
    }
  });
  it("rejects an opening with pages and choices nested inside the guide even if the provider violates its schema", async () => {
    const output = startResponse();
    mocks.chat.mockResolvedValueOnce(
      response({
        title: output.title,
        storyGuide: {
          ...output.storyGuide,
          pages: output.pages,
          choice: output.choice,
        },
        safetyNotes: [],
      }),
    );
    await expect(generatePicturebookStart(input, "token")).rejects.toThrow(
      "이야기를 만들지 못했어요",
    );
    expect(mocks.chat).toHaveBeenCalledTimes(1);
  });
  it("rejects an ending with pages nested inside a guide even if the provider violates its schema", async () => {
    mocks.chat.mockResolvedValueOnce(
      response({
        storyGuide: { ...storyGuide, pages: endingResponse().pages },
        safetyNotes: [],
      }),
    );
    await expect(
      generatePicturebookEnding(book(), "A", "token"),
    ).rejects.toThrow("결말을 만들지 못했어요");
    expect(mocks.chat).toHaveBeenCalledTimes(1);
  });
});

describe("validated endings", () => {
  it("continues saved books without invalidating old narration, labels, or absent guides", async () => {
    const opening = book();
    opening.ageBand = "8+";
    opening.tone = "brave";
    opening.pages = opening.pages.map(page => ({
      ...page,
      textKo: "바람에 문이 조금 흔들렸다. 아이는 인형을 품에 안았다.",
    }));
    opening.choice.options[0].labelKo = "손 내밀기요";
    const ending = endingResponse();
    ending.pages = ending.pages.map(page => ({
      ...page,
      textKo: "아이는 인형에게 손을 내밀었다. 창가에 그림자가 작아졌다.",
    }));
    mocks.chat.mockResolvedValueOnce(response(ending));
    approveNextReview();
    const result = await generatePicturebookEnding(opening, "A", "token");
    expect(result.pages.slice(0, 4)).toEqual(opening.pages);
    expect(result.choice).toEqual(opening.choice);
    expect(result.status).toBe("complete");
    expect(mocks.chat).toHaveBeenCalledTimes(2);
  });
  it("preserves the opening, guide and chosen action when completing the book", async () => {
    const opening = { ...book(), storyGuide };
    mocks.chat.mockResolvedValueOnce(response(endingResponse()));
    approveNextReview();
    const result = await generatePicturebookEnding(opening, "B", "token");
    expect(result.status).toBe("complete");
    expect(result.selectedChoiceId).toBe("B");
    expect(result.pages.slice(0, 4)).toEqual(opening.pages);
    expect(result.storyGuide).toEqual(storyGuide);
    expect(result.pages).toHaveLength(8);
    expect(result.pages[7].emotionalBeat).toBe("calm-close");
    expect(opening.status).toBe("choice-ready");
    const material = reviewMaterial(mocks.chat.mock.calls[1][0]);
    expect(material.stage).toBe("ending");
    expect(material.sources["choice:B"]).toContain(
      opening.choice.options[1].labelKo,
    );
    expect(material.sources["page:1"]).toContain(opening.pages[0].textKo);
    expect(material.sources["page:8"]).toContain(result.pages[7].textKo);
    expect(material.sources["visual-guide"]).toContain(storyGuide.visualStyle);
  });
  it.each(["A", "B", "C"] as const)(
    "shows only selected action %s, actual pages and appearance in both ending reviews",
    async selectedChoiceId => {
      const opening = {
        ...book(),
        storyGuide: {
          ...storyGuide,
          coreConflict: "계획에서만 다뤄진 갈등이에요.",
          resolutionGoal: "실제 본문에는 없는 계획 속 해결이에요.",
        },
      };
      opening.choice.options.forEach(option => {
        option.resolutionHint = `작가가 미리 주장하는 ${option.id} 행동의 성공이에요.`;
      });
      const ending = endingResponse();
      mocks.chat.mockResolvedValueOnce(response(ending));
      rejectNextReview();
      mocks.chat.mockResolvedValueOnce(response({ pages: [ending.pages[0]] }));
      approveNextReview();
      const result = await generatePicturebookEnding(
        opening,
        selectedChoiceId,
        "token",
      );

      for (const index of [1, 3]) {
        const material = reviewMaterial(mocks.chat.mock.calls[index][0]);
        const serialized = JSON.stringify(material);
        expect(material.selectedChoiceId).toBe(selectedChoiceId);
        expect(material).not.toHaveProperty("candidate");
        expect(material).not.toHaveProperty("pages");
        expect(material).not.toHaveProperty("storyGuide");
        expect(material.sources["visual-guide"]).toBe(storyGuide.visualStyle);
        expect(serialized).not.toContain(opening.storyGuide.coreConflict);
        expect(serialized).not.toContain(opening.storyGuide.resolutionGoal);
        for (const option of opening.choice.options) {
          expect(serialized).not.toContain(option.resolutionHint);
          if (option.id === selectedChoiceId) {
            expect(material.sources[`choice:${option.id}`]).toBe(
              option.labelKo,
            );
          } else {
            expect(material.sources).not.toHaveProperty(`choice:${option.id}`);
            expect(serialized).not.toContain(option.labelKo);
          }
        }
        for (const page of result.pages) {
          expect(material.sources[`page:${page.pageNumber}`]).toBe(page.textKo);
        }
      }
      expect(result.choice).toEqual(opening.choice);
      expect(result.storyGuide).toEqual(opening.storyGuide);
      expect(mocks.chat).toHaveBeenCalledTimes(4);
    },
  );
  it.each(["A", "C"] as const)(
    "rejects review evidence taken from unselected action %s when B was selected",
    async unselectedChoiceId => {
      const opening = book();
      const unselected = opening.choice.options.find(
        option => option.id === unselectedChoiceId,
      )!;
      mocks.chat.mockResolvedValueOnce(response(endingResponse()));
      mocks.chat.mockImplementationOnce(async request => {
        const review = approvedReview(request);
        review.checks[1].evidence = [
          { source: `choice:${unselectedChoiceId}`, quote: unselected.labelKo },
        ];
        return response(review);
      });
      await expect(
        generatePicturebookEnding(opening, "B", "token"),
      ).rejects.toThrow("결말을 만들지 못했어요");
      expect(mocks.chat).toHaveBeenCalledTimes(2);
    },
  );
  it("does not mark missing ending text complete", async () => {
    mocks.chat.mockResolvedValueOnce(response({ pages: [{}, {}, {}, {}] }));
    await expect(
      generatePicturebookEnding(book(), "A", "token"),
    ).rejects.toThrow("결말을 만들지 못했어요");
    expect(mocks.chat).toHaveBeenCalledTimes(1);
  });
  it("applies an approved ending correction without changing pages already read", async () => {
    const opening = { ...book(), storyGuide };
    const ending = endingResponse();
    const changedPage = {
      ...ending.pages[0],
      emotionalBeat: "resolution",
      textKo:
        "인형의 작은 손을 친구 쪽으로 내밀었어요. 친구가 손끝을 살짝 흔들었어요.",
    };
    mocks.chat.mockResolvedValueOnce(response(ending));
    rejectNextReview();
    mocks.chat.mockResolvedValueOnce(response({ pages: [changedPage] }));
    approveNextReview();
    const result = await generatePicturebookEnding(opening, "A", "token");
    expect(result.pages.slice(0, 4)).toEqual(opening.pages);
    expect(result.pages[4]).toEqual(changedPage);
    expect(result.pages.slice(5).map(page => page.textKo)).toEqual(
      ending.pages.slice(1).map(page => page.textKo),
    );
    expect(result.choice).toEqual(opening.choice);
    expect(result.storyGuide).toEqual(storyGuide);
    expect(result.title).toEqual(opening.title);
    expect(mocks.chat).toHaveBeenCalledTimes(4);
  });
  it.each([
    ["opening page", { pages: [book().pages[0]] }],
    ["choice", { pages: [], choice: book().choice }],
    ["title", { pages: [], title: "바뀐 제목" }],
    ["story guide", { pages: [], storyGuide }],
  ])(
    "rejects an ending patch that changes the protected %s",
    async (_, patch) => {
      mocks.chat.mockResolvedValueOnce(response(endingResponse()));
      rejectNextReview();
      mocks.chat.mockResolvedValueOnce(response(patch));
      await expect(
        generatePicturebookEnding({ ...book(), storyGuide }, "A", "token"),
      ).rejects.toThrow("결말을 만들지 못했어요");
      expect(mocks.chat).toHaveBeenCalledTimes(3);
    },
  );
  it("does not mark an unchecked ending complete if its review times out", async () => {
    mocks.chat.mockResolvedValueOnce(response(endingResponse()));
    mocks.chat.mockRejectedValueOnce(new Error("review timeout"));
    await expect(
      generatePicturebookEnding(book(), "A", "token"),
    ).rejects.toThrow("결말을 만들지 못했어요");
    expect(mocks.chat).toHaveBeenCalledTimes(2);
  });
});

describe("illustration continuity", () => {
  it.each(["3-4", "8+"] as const)(
    "uses the canonical appearance and accepts age band %s",
    async ageBand => {
      await generatePicturebookPageImage(
        { ...imageInput, ageBand, visualStyle: storyGuide.visualStyle },
        "token",
      );
      expect(mocks.image).toHaveBeenCalledTimes(1);
      expect(mocks.image.mock.calls[0][0].prompt).toContain(
        storyGuide.visualStyle,
      );
      expect(mocks.image.mock.calls[0][0].prompt).toContain(ageBand);
    },
  );
  it("rejects an oversized canonical appearance before calling the provider", async () => {
    await expect(
      generatePicturebookPageImage(
        { ...imageInput, visualStyle: "x".repeat(1201) },
        "token",
      ),
    ).rejects.toThrow("그림 요청을 확인해주세요");
    expect(mocks.image).not.toHaveBeenCalled();
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
