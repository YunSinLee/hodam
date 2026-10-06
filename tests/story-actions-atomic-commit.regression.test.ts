import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { book, input } from "./fixtures";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  from: vi.fn(),
  quota: vi.fn(),
  commit: vi.fn(),
  generate: vi.fn(),
  createClient: vi.fn(),
  ready: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));
vi.mock("@/app/api/server-auth", () => ({ requireServerUser: mocks.auth }));
vi.mock("@/app/api/langchain", () => ({
  generatePicturebookStart: mocks.generate,
  generatePicturebookEnding: vi.fn(),
  generatePicturebookPageImage: vi.fn(),
}));

import { createPicturebookAction } from "../src/app/api/story-actions";

const requestId = "3f1f11ec-b83d-45eb-bcaf-2ad09fa105cb";
const owner = "2e48cb8c-ae55-4e42-8bd2-f3edc3b021a6";
const saved = () => ({
  thread_id: 42,
  raw_text: JSON.stringify(book()),
  bead_count: 9,
});
function query(data: unknown, error: unknown = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    single: vi.fn().mockResolvedValue({ data, error }),
  };
  mocks.from.mockReturnValueOnce(chain);
  return chain;
}
const newRequest = () => {
  query(null);
  query({ count: 10 });
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "synthetic-server-key");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase.test");
  mocks.auth.mockResolvedValue({
    user: { id: owner },
    client: { from: mocks.from, rpc: mocks.quota },
  });
  mocks.createClient.mockReturnValue({
    rpc: (name: string, ...args: unknown[]) =>
      name === "picturebook_storage_ready"
        ? mocks.ready()
        : mocks.commit(name, ...args),
  });
  mocks.ready.mockResolvedValue({ data: true, error: null });
  mocks.quota.mockResolvedValue({ data: [{ allowed: true }], error: null });
  mocks.generate.mockResolvedValue(book());
  mocks.commit.mockResolvedValue({ data: [saved()], error: null });
});
afterEach(() => vi.unstubAllEnvs());

describe("atomic picturebook commit boundary", () => {
  it("writes only through the server client using the authenticated owner", async () => {
    newRequest();
    const result = await createPicturebookAction(
      { ...input, userId: "attacker" } as typeof input,
      "token",
      requestId,
    );
    expect(result).toMatchObject({ ok: true, threadId: 42, beadCount: 9 });
    expect(mocks.createClient).toHaveBeenCalledExactlyOnceWith(
      "https://supabase.test",
      "synthetic-server-key",
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    expect(mocks.commit).toHaveBeenCalledExactlyOnceWith(
      "commit_picturebook_start",
      { p_user_id: owner, p_request_id: requestId, p_book: book() },
    );
    expect(mocks.from).toHaveBeenCalledTimes(2);
    expect(mocks.quota).toHaveBeenCalledExactlyOnceWith(
      "consume_daily_quota",
      expect.objectContaining({ p_user_id: owner }),
    );
    expect(mocks.ready).toHaveBeenCalledOnce();
    expect(mocks.ready.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.quota.mock.invocationCallOrder[0],
    );
  });

  it.each(["SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_URL"])(
    "does not invoke the model when %s is missing",
    async name => {
      vi.stubEnv(name, "");
      newRequest();
      expect(
        await createPicturebookAction(input, "token", requestId),
      ).toMatchObject({
        ok: false,
        retryable: false,
        retrySameRequest: false,
        message: expect.stringContaining("저장 서비스"),
      });
      expect(mocks.generate).not.toHaveBeenCalled();
      expect(mocks.quota).not.toHaveBeenCalled();
      expect(mocks.commit).not.toHaveBeenCalled();
    },
  );

  it("still recovers a completed saved book while the server key is unavailable", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const completed = book("complete");
    query({ id: 42, raw_text: JSON.stringify(completed) });
    query({ count: 0 });
    expect(await createPicturebookAction(input, "token", requestId)).toEqual({
      ok: true,
      threadId: 42,
      beadCount: 0,
      book: completed,
    });
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.ready).not.toHaveBeenCalled();
  });

  it.each([
    { data: false, error: null },
    { data: null, error: null },
    { data: "true", error: null },
    { data: [{ ready: true }], error: null },
    {
      data: true,
      error: { code: "PGRST202", message: "private missing schema details" },
    },
    {
      data: null,
      error: { status: 401, message: "private invalid key details" },
    },
    {
      data: null,
      error: { code: "42501", message: "private permission details" },
    },
  ])(
    "stops before quota and paid generation when storage readiness is not confirmed %#",
    async result => {
      newRequest();
      mocks.ready.mockResolvedValue(result);
      expect(await createPicturebookAction(input, "token", requestId)).toEqual({
        ok: false,
        message:
          "그림책 저장 서비스에 연결할 수 없어요. 운영팀에 문의해주세요.",
        retryable: false,
        retrySameRequest: false,
      });
      expect(mocks.quota).not.toHaveBeenCalled();
      expect(mocks.generate).not.toHaveBeenCalled();
      expect(mocks.commit).not.toHaveBeenCalled();
    },
  );

  it("handles a thrown readiness check without exposing its error or generating", async () => {
    newRequest();
    mocks.ready.mockRejectedValue(new Error("private key lookup details"));
    expect(await createPicturebookAction(input, "token", requestId)).toEqual({
      ok: false,
      message: "그림책 저장 서비스에 연결할 수 없어요. 운영팀에 문의해주세요.",
      retryable: false,
      retrySameRequest: false,
    });
    expect(mocks.quota).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it("does not expose configuration exceptions or invoke the model if the server client cannot be created", async () => {
    newRequest();
    mocks.createClient.mockImplementation(() => {
      throw new Error("synthetic-secret configuration details");
    });
    const result = await createPicturebookAction(input, "token", requestId);
    expect(result).toMatchObject({
      ok: false,
      retryable: false,
      retrySameRequest: false,
    });
    expect(JSON.stringify(result)).not.toContain("synthetic-secret");
    expect(mocks.quota).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it("returns the winning request's complete book without replacing it with the newly generated draft", async () => {
    newRequest();
    const winner = { ...book("complete"), title: "이미 완성된 책" };
    mocks.commit.mockResolvedValue({
      data: [{ ...saved(), raw_text: JSON.stringify(winner) }],
    });
    expect(await createPicturebookAction(input, "token", requestId)).toEqual({
      ok: true,
      threadId: 42,
      beadCount: 9,
      book: winner,
    });
    expect(mocks.commit).toHaveBeenCalledOnce();
  });

  it.each([
    null,
    undefined,
    {},
    [],
    [saved(), saved()],
    [{ ...saved(), raw_text: "" }],
    [{ ...saved(), raw_text: "not JSON" }],
    [{ ...saved(), raw_text: JSON.stringify({ ...book(), pages: [] }) }],
    [{ ...saved(), thread_id: "42" }],
    [{ ...saved(), thread_id: 0 }],
    [{ ...saved(), thread_id: -1 }],
    [{ ...saved(), thread_id: Number.MAX_SAFE_INTEGER + 1 }],
    [{ ...saved(), bead_count: null }],
    [{ ...saved(), bead_count: "9" }],
    [{ ...saved(), bead_count: -1 }],
    [{ ...saved(), bead_count: 1.5 }],
  ])("does not claim success for malformed commit data %#", async data => {
    newRequest();
    mocks.commit.mockResolvedValue({ data, error: null });
    expect(
      await createPicturebookAction(input, "token", requestId),
    ).toMatchObject({ ok: false, retrySameRequest: true });
    expect(mocks.commit).toHaveBeenCalledExactlyOnceWith(
      "commit_picturebook_start",
      expect.any(Object),
    );
    expect(mocks.from).toHaveBeenCalledTimes(2);
  });

  it.each([
    "PICTUREBOOK_REQUEST_UNRESOLVED",
    "INSUFFICIENT_BEADS",
    "BEAD_BALANCE_UNAVAILABLE",
    "INVALID_PICTUREBOOK_REQUEST",
    "FORBIDDEN",
  ])(
    "returns a safe error and never estimates a refund for %s",
    async message => {
      newRequest();
      mocks.commit.mockResolvedValue({
        data: null,
        error: { message, details: "private database detail" },
      });
      const result = await createPicturebookAction(input, "token", requestId);
      expect(result).toMatchObject({
        ok: false,
        retryable: false,
        retrySameRequest: true,
      });
      expect(JSON.stringify(result)).not.toContain(message);
      expect(JSON.stringify(result)).not.toContain("private");
      expect(mocks.commit).toHaveBeenCalledExactlyOnceWith(
        "commit_picturebook_start",
        expect.any(Object),
      );
    },
  );

  it("keeps an ambiguous transaction available for a later saved-book lookup", async () => {
    newRequest();
    mocks.commit.mockRejectedValue(new Error("private database failure"));
    expect(
      await createPicturebookAction(input, "token", requestId),
    ).toMatchObject({ ok: false, retrySameRequest: true, retryable: true });
    query({ id: 42, raw_text: JSON.stringify(book()) });
    query({ count: 9 });
    expect(
      await createPicturebookAction(input, "token", requestId),
    ).toMatchObject({ ok: true, threadId: 42, beadCount: 9 });
    expect(mocks.generate).toHaveBeenCalledOnce();
    expect(mocks.commit).toHaveBeenCalledTimes(2);
    expect(mocks.commit.mock.calls[0]).toEqual(mocks.commit.mock.calls[1]);
  });
});
