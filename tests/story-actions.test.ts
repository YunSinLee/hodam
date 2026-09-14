import { beforeEach, describe, expect, it, vi } from "vitest";
import { book, input } from "./fixtures";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  generate: vi.fn(),
  ending: vi.fn(),
  image: vi.fn(),
  signedUrl: vi.fn(),
  upload: vi.fn(),
  adminRpc: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ rpc: mocks.adminRpc }),
}));
vi.mock("@/app/api/server-auth", () => ({ requireServerUser: mocks.auth }));
vi.mock("@/app/api/langchain", () => ({
  generatePicturebookStart: mocks.generate,
  generatePicturebookEnding: mocks.ending,
  generatePicturebookPageImage: mocks.image,
}));
import {
  createPicturebookAction,
  finishPicturebookAction,
  drawPicturebookPageAction,
} from "../src/app/api/story-actions";
const requestId = "abcde123-1234-4321-abcd-123456789012";
const queries: Array<{ table: string; steps: Array<[string, unknown[]]> }> = [];
function query(data: unknown, error: unknown = null) {
  const steps: Array<[string, unknown[]]> = [];
  const result = { data, error };
  const chain: Record<string, any> = {
    then: (resolve: (r: unknown) => unknown) =>
      Promise.resolve(result).then(resolve),
  };
  ["select", "eq", "insert", "update"].forEach(method => {
    chain[method] = (...args: unknown[]) => {
      steps.push([method, args]);
      return chain;
    };
  });
  chain.single = chain.maybeSingle = () => Promise.resolve(result);
  mocks.from.mockImplementationOnce((table: string) => {
    queries.push({ table, steps });
    return chain;
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  queries.length = 0;
  mocks.auth.mockResolvedValue({
    user: { id: "owner" },
    client: {
      from: mocks.from,
      rpc: mocks.rpc,
      storage: {
        from: () => ({
          createSignedUrl: mocks.signedUrl,
          upload: mocks.upload,
        }),
      },
    },
  });
  mocks.generate.mockResolvedValue(book());
  mocks.ending.mockResolvedValue(book("complete"));
  mocks.image.mockResolvedValue({
    data: [
      {
        b64_json:
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXm0AAAAASUVORK5CYII=",
      },
    ],
  });
  mocks.signedUrl.mockResolvedValue({
    data: null,
    error: { message: "Object not found", statusCode: "404" },
  });
  mocks.upload.mockResolvedValue({ data: { path: "image" }, error: null });
  mocks.rpc.mockImplementation((name: string) =>
    Promise.resolve(
      name === "consume_daily_quota"
        ? { data: [{ allowed: true }] }
        : { data: 9 },
    ),
  );
});
describe("saved picturebook creation", () => {
  it("rejects invalid input before invoking any paid generation", async () => {
    const result = await createPicturebookAction(
      { ...input, childAge: "99" },
      "token",
      requestId,
    );
    expect(result.ok).toBe(false);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("never consumes a bead when the AI request fails", async () => {
    query(null);
    query({ count: 10 });
    mocks.generate.mockRejectedValue(new Error("temporarily unavailable"));
    const result = await createPicturebookAction(input, "token", requestId);
    expect(result.ok).toBe(false);
    expect(
      mocks.rpc.mock.calls.filter(([name]) => name === "consume_beads"),
    ).toHaveLength(0);
  });
  it("does not invoke AI when balance is exhausted", async () => {
    query(null);
    query({ count: 0 });
    expect((await createPicturebookAction(input, "token", requestId)).ok).toBe(
      false,
    );
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("deduplicates simultaneous clicks into one generation and one debit", async () => {
    query(null);
    query({ count: 10 });
    query({ id: 42 });
    query({ id: 42 });
    const [first, second] = await Promise.all([
      createPicturebookAction(input, "token", requestId),
      createPicturebookAction(input, "token", requestId),
    ]);
    expect(first).toEqual(second);
    expect(first).toMatchObject({ ok: true, threadId: 42, beadCount: 9 });
    expect(mocks.generate).toHaveBeenCalledTimes(1);
    expect(
      mocks.rpc.mock.calls.filter(([name]) => name === "consume_beads"),
    ).toHaveLength(1);
  });
  it("recovers a saved request across a later retry without another generation", async () => {
    query({ id: 42, raw_text: JSON.stringify(book()) });
    query({ count: 9 });
    expect(
      await createPicturebookAction(input, "token", requestId),
    ).toMatchObject({ ok: true, threadId: 42 });
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("recognizes a successful save after a lost response instead of refunding it", async () => {
    query(null);
    query({ count: 10 });
    query({ id: 42 });
    query(null, new Error("lost response"));
    query({ raw_text: JSON.stringify(book()) });
    query({ count: 9 });
    expect(
      await createPicturebookAction(input, "token", requestId),
    ).toMatchObject({ ok: true, threadId: 42, beadCount: 9 });
  });
  it("does not claim a failed database save succeeded", async () => {
    query(null);
    query({ count: 10 });
    query({ id: 42 });
    query(null, new Error("write failed"));
    query(null, new Error("database offline"));
    expect((await createPicturebookAction(input, "token", requestId)).ok).toBe(
      false,
    );
  });
});
describe("saved-book continuation", () => {
  it("cannot generate an ending for another account's book", async () => {
    query(null, new Error("not found"));
    expect(await finishPicturebookAction(42, "A", "token")).toMatchObject({
      ok: false,
    });
    expect(queries[0].steps).toContainEqual(["eq", ["user_id", "owner"]]);
    expect(mocks.ending).not.toHaveBeenCalled();
  });
  it("returns an existing ending without another paid request", async () => {
    query({ raw_text: JSON.stringify(book("complete")) });
    expect(await finishPicturebookAction(42, "A", "token")).toMatchObject({
      ok: true,
      book: { status: "complete" },
    });
    expect(mocks.ending).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("preserves the first saved ending when a second choice arrives concurrently", async () => {
    query({ raw_text: JSON.stringify(book()) });
    query([]);
    const winner = { ...book("complete"), selectedChoiceId: "B" };
    query({ raw_text: JSON.stringify(winner) });
    expect(await finishPicturebookAction(42, "A", "token")).toEqual({
      ok: true,
      book: winner,
    });
    expect(
      mocks.rpc.mock.calls.filter(([name]) => name === "consume_beads"),
    ).toHaveLength(0);
  });
  it("allows image generation only for pages present in the owner's saved book", async () => {
    query({ raw_text: JSON.stringify(book()) });
    expect(await drawPicturebookPageAction(42, 8, "token")).toMatchObject({
      ok: false,
      message: "그림책 페이지가 없어요.",
    });
    expect(mocks.image).not.toHaveBeenCalled();
  });
});

describe("server action validation and accounting recovery", () => {
  it.each(["-".repeat(36), "a".repeat(36), undefined, 42])(
    "rejects malformed request id %s without authentication or generation",
    async value => {
      expect(
        await createPicturebookAction(input, "token", value as string),
      ).toMatchObject({ ok: false });
      expect(mocks.auth).not.toHaveBeenCalled();
    },
  );
  it.each([null, undefined, -1, "10", Number.NaN])(
    "rejects an invalid balance %s before spending generation quota",
    async count => {
      query(null);
      query({ count });
      expect(
        await createPicturebookAction(input, "token", requestId),
      ).toMatchObject({ ok: false });
      expect(mocks.rpc).not.toHaveBeenCalled();
      expect(mocks.generate).not.toHaveBeenCalled();
    },
  );
  it("rejects an invalid generated book before reserving a row or debiting", async () => {
    query(null);
    query({ count: 10 });
    mocks.generate.mockResolvedValue({ ...book(), pages: [] });
    expect(
      await createPicturebookAction(input, "token", requestId),
    ).toMatchObject({ ok: false });
    expect(mocks.from).toHaveBeenCalledTimes(2);
    expect(
      mocks.rpc.mock.calls.filter(([name]) => name === "consume_beads"),
    ).toHaveLength(0);
  });
  it("recovers a lost debit response using the same idempotency key before saving", async () => {
    query(null);
    query({ count: 10 });
    query({ id: 42 });
    query({ id: 42 });
    mocks.rpc
      .mockResolvedValueOnce({ data: [{ allowed: true }] })
      .mockResolvedValueOnce({ error: { message: "lost response" } })
      .mockResolvedValueOnce({ data: 9 });
    expect(
      await createPicturebookAction(input, "token", requestId),
    ).toMatchObject({ ok: true, beadCount: 9 });
    const debits = mocks.rpc.mock.calls.filter(
      ([name]) => name === "consume_beads",
    );
    expect(debits).toHaveLength(2);
    expect(debits[0]).toEqual(debits[1]);
    expect(mocks.generate).toHaveBeenCalledTimes(1);
    expect(mocks.adminRpc).not.toHaveBeenCalled();
  });
  it("retains request identity when both debit responses are ambiguous", async () => {
    query(null);
    query({ count: 10 });
    query({ id: 42 });
    mocks.rpc
      .mockResolvedValueOnce({ data: [{ allowed: true }] })
      .mockResolvedValue({ error: { message: "database timeout" } });
    expect(
      await createPicturebookAction(input, "token", requestId),
    ).toMatchObject({ ok: false, retrySameRequest: true });
    expect(mocks.adminRpc).not.toHaveBeenCalled();
  });
  it("does not repeat generation for an unfinished saved request", async () => {
    query({ id: 42, raw_text: null });
    query({ count: 9 });
    expect(
      await createPicturebookAction(input, "token", requestId),
    ).toMatchObject({ ok: false, retrySameRequest: true });
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("returns authentication failures as a serializable result", async () => {
    mocks.auth.mockRejectedValue(
      new Error("로그인이 만료됐어요. 다시 로그인해주세요."),
    );
    expect(
      await createPicturebookAction(input, "token", requestId),
    ).toMatchObject({ ok: false, message: expect.stringContaining("로그인") });
    expect(await finishPicturebookAction(42, "A", "token")).toMatchObject({
      ok: false,
    });
    expect(await drawPicturebookPageAction(42, 1, "token")).toMatchObject({
      ok: false,
    });
  });
  it("marks provider credit exhaustion as non-retryable without charging", async () => {
    query(null);
    query({ count: 10 });
    mocks.generate.mockRejectedValue(
      Object.assign(
        new Error(
          "이야기 생성 서비스의 이용 한도가 소진됐어요. 운영팀에 문의해주세요.",
        ),
        { retryable: false },
      ),
    );
    expect(
      await createPicturebookAction(input, "token", requestId),
    ).toMatchObject({ ok: false, retryable: false, retrySameRequest: false });
    expect(
      mocks.rpc.mock.calls.filter(([name]) => name === "consume_beads"),
    ).toHaveLength(0);
  });
});

describe("ending failure boundaries", () => {
  it("never marks a malformed ending complete", async () => {
    query({ raw_text: JSON.stringify(book()) });
    mocks.ending.mockResolvedValue({
      ...book("complete"),
      pages: book().pages,
    });
    expect(await finishPicturebookAction(42, "A", "token")).toMatchObject({
      ok: false,
    });
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });
  it("recovers an ending that saved despite a lost write response", async () => {
    query({ raw_text: JSON.stringify(book()) });
    query(null, new Error("lost response"));
    query({ raw_text: JSON.stringify(book("complete")) });
    expect(await finishPicturebookAction(42, "A", "token")).toMatchObject({
      ok: true,
      book: { status: "complete" },
    });
    expect(mocks.ending).toHaveBeenCalledTimes(1);
  });
  it("returns a safe provider service error instead of a production-sanitized exception", async () => {
    query({ raw_text: JSON.stringify(book()) });
    const message =
      "이야기 생성 서비스의 이용 한도가 소진됐어요. 운영팀에 문의해주세요.";
    mocks.ending.mockRejectedValue(
      Object.assign(new Error(message), { retryable: false }),
    );
    expect(await finishPicturebookAction(42, "A", "token")).toEqual({
      ok: false,
      message,
      retryable: false,
    });
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });
  it("deduplicates simultaneous choices on one worker", async () => {
    query({ raw_text: JSON.stringify(book()) });
    query([{ id: 42 }]);
    const results = await Promise.all([
      finishPicturebookAction(42, "A", "token"),
      finishPicturebookAction(42, "B", "token"),
    ]);
    expect(results[0]).toEqual(results[1]);
    expect(results[0].ok).toBe(true);
    expect(mocks.ending).toHaveBeenCalledTimes(1);
  });
  it("does not call the model when the daily quota is exhausted", async () => {
    query({ raw_text: JSON.stringify(book()) });
    mocks.rpc.mockResolvedValue({ data: [{ allowed: false }] });
    expect(await finishPicturebookAction(42, "A", "token")).toMatchObject({
      ok: false,
      retryable: false,
    });
    expect(mocks.ending).not.toHaveBeenCalled();
  });
});

describe("private saved page images", () => {
  it.each([
    undefined,
    "별이는 노란 잠옷을 입어요. 흰 토끼 인형과 수채화 장면.",
  ])(
    "passes saved age and optional shared visual context to image generation: %s",
    async visualStyle => {
      const saved = book();
      if (visualStyle)
        saved.storyGuide = {
          coreConflict: "불을 끄면 혼자 잠들기 어려워해요.",
          characters: ["노란 잠옷을 입은 별이", "흰 토끼 인형"],
          keyObject: "흰 토끼 인형",
          resolutionGoal: "토끼를 안고 안심하며 누워 있어요.",
          visualStyle,
        };
      query({ raw_text: JSON.stringify(saved) });
      query({ id: 42 });
      mocks.signedUrl
        .mockResolvedValueOnce({ data: null, error: { code: "NoSuchKey" } })
        .mockResolvedValueOnce({
          data: { signedUrl: "https://storage.test/generated" },
          error: null,
        });
      expect(await drawPicturebookPageAction(42, 1, "token")).toEqual({
        ok: true,
        url: "https://storage.test/generated",
      });
      expect(mocks.image).toHaveBeenCalledWith(
        {
          title: saved.title,
          childName: saved.childName,
          ageBand: saved.ageBand,
          visualStyle,
          pageNumber: 1,
          textKo: saved.pages[0].textKo,
          imagePrompt: saved.pages[0].imagePrompt,
        },
        "token",
      );
    },
  );

  it("reuses a saved image and repairs its book marker without a paid request", async () => {
    query({ raw_text: JSON.stringify(book()) });
    query({ id: 42 });
    mocks.signedUrl.mockResolvedValue({
      data: { signedUrl: "https://storage.test/saved" },
      error: null,
    });
    expect(await drawPicturebookPageAction(42, 1, "token")).toEqual({
      ok: true,
      url: "https://storage.test/saved",
    });
    expect(mocks.image).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(queries[1].steps).toContainEqual(["update", [{ has_image: true }]]);
  });
  it.each([
    { message: "Invalid JWT", statusCode: "401" },
    { message: "Database timeout", statusCode: "504" },
    { message: "Bucket not found", statusCode: "404" },
  ])("does not redraw when a cache lookup fails: %s", async error => {
    query({ raw_text: JSON.stringify(book()) });
    mocks.signedUrl.mockResolvedValue({ data: null, error });
    expect(await drawPicturebookPageAction(42, 1, "token")).toMatchObject({
      ok: false,
    });
    expect(mocks.image).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([undefined, "not base64", "aGVsbG8=", "iVBORw0KGgo==="])(
    "does not upload invalid image output %s",
    async b64_json => {
      query({ raw_text: JSON.stringify(book()) });
      mocks.image.mockResolvedValue({ data: [{ b64_json }] });
      expect(await drawPicturebookPageAction(42, 1, "token")).toMatchObject({
        ok: false,
      });
      expect(mocks.upload).not.toHaveBeenCalled();
    },
  );
  it("keeps the first saved image when another server wins the upload", async () => {
    query({ raw_text: JSON.stringify(book()) });
    query({ id: 42 });
    mocks.signedUrl
      .mockResolvedValueOnce({ data: null, error: { code: "NoSuchKey" } })
      .mockResolvedValueOnce({
        data: { signedUrl: "https://storage.test/winner" },
        error: null,
      });
    mocks.upload.mockResolvedValue({
      error: { statusCode: "409", message: "Already exists" },
    });
    expect(await drawPicturebookPageAction(42, 1, "token")).toEqual({
      ok: true,
      url: "https://storage.test/winner",
    });
    expect(mocks.upload).toHaveBeenCalledWith(
      "image_thread_id_42_page_1",
      expect.any(Buffer),
      { contentType: "image/png", upsert: false },
    );
  });
  it("does not claim success when the image cannot be connected to the book", async () => {
    query({ raw_text: JSON.stringify(book()) });
    query(null, new Error("marker update failed"));
    mocks.signedUrl.mockResolvedValue({
      data: { signedUrl: "https://storage.test/saved" },
      error: null,
    });
    expect(await drawPicturebookPageAction(42, 1, "token")).toMatchObject({
      ok: false,
      message: expect.stringContaining("책장에 연결"),
    });
  });
  it("returns provider quota errors so the client can stop its image queue", async () => {
    query({ raw_text: JSON.stringify(book()) });
    mocks.image.mockRejectedValue(
      Object.assign(
        new Error(
          "이야기 생성 서비스의 이용 한도가 소진됐어요. 운영팀에 문의해주세요.",
        ),
        { retryable: false },
      ),
    );
    expect(await drawPicturebookPageAction(42, 1, "token")).toMatchObject({
      ok: false,
      retryable: false,
    });
    expect(mocks.upload).not.toHaveBeenCalled();
  });
});
