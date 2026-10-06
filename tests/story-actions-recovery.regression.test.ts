import { beforeEach, describe, expect, it, vi } from "vitest";

import { book, input } from "./fixtures";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  generate: vi.fn(),
  adminRpc: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ rpc: mocks.adminRpc }),
}));
vi.mock("@/app/api/server-auth", () => ({ requireServerUser: mocks.auth }));
vi.mock("@/app/api/langchain", () => ({
  generatePicturebookStart: mocks.generate,
  generatePicturebookEnding: vi.fn(),
  generatePicturebookPageImage: vi.fn(),
}));

import { createPicturebookAction } from "../src/app/api/story-actions";

const requestId = "05f7aeb1-f035-4c72-9fb9-dca1de96f8fb";
const queries: Array<{ table: string; steps: Array<[string, unknown[]]> }> = [];

function query(data: unknown, error: unknown = null, reject = false) {
  const steps: Array<[string, unknown[]]> = [];
  const result = { data, error };
  const finish = () =>
    reject ? Promise.reject(error) : Promise.resolve(result);
  const chain: Record<string, unknown> = {};
  ["select", "eq", "insert", "update"].forEach(method => {
    chain[method] = (...args: unknown[]) => {
      steps.push([method, args]);
      return chain;
    };
  });
  chain.single = chain.maybeSingle = finish;
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
    client: { from: mocks.from, rpc: mocks.rpc },
  });
  mocks.generate.mockResolvedValue(book());
  mocks.rpc.mockImplementation((name: string) =>
    Promise.resolve(
      name === "consume_daily_quota"
        ? { data: [{ allowed: true }] }
        : { data: 9 },
    ),
  );
});

describe("picturebook request recovery across server failures", () => {
  it("retains the original request while authentication cannot be confirmed", async () => {
    mocks.auth.mockRejectedValue(new Error("session lookup unavailable"));

    expect(
      await createPicturebookAction(input, "token", requestId),
    ).toMatchObject({
      ok: false,
      retrySameRequest: true,
    });
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "retains an existing request when its lookup fails (throws: %s)",
    async reject => {
      query(null, new Error("lookup unavailable"), reject);

      expect(
        await createPicturebookAction(input, "token", requestId),
      ).toMatchObject({
        ok: false,
        retrySameRequest: true,
      });
      expect(mocks.generate).not.toHaveBeenCalled();
      expect(mocks.rpc).not.toHaveBeenCalled();
    },
  );

  it("retains a saved request when only its balance lookup fails", async () => {
    query({ id: 42, raw_text: JSON.stringify(book()) });
    query(null, new Error("balance unavailable"));

    expect(
      await createPicturebookAction(input, "token", requestId),
    ).toMatchObject({
      ok: false,
      retrySameRequest: true,
    });
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "recovers the winning worker's saved book after INSERT failure (throws: %s)",
    async reject => {
      const winner = { ...book(), title: "먼저 저장된 그림책" };
      query(null);
      query({ count: 10 });
      query(null, { code: "23505", message: "request already exists" }, reject);
      query({ id: 42, raw_text: JSON.stringify(winner) });
      query({ count: 9 });

      expect(await createPicturebookAction(input, "token", requestId)).toEqual({
        ok: true,
        book: winner,
        threadId: 42,
        beadCount: 9,
      });
      expect(queries[3].steps).toContainEqual(["eq", ["user_id", "owner"]]);
      expect(queries[3].steps).toContainEqual([
        "eq",
        ["openai_thread_id", `picturebook_${requestId}`],
      ]);
      expect(
        mocks.rpc.mock.calls.filter(([name]) => name === "consume_beads"),
      ).toHaveLength(0);
      expect(mocks.adminRpc).not.toHaveBeenCalled();
    },
  );

  it("retains the same request when another worker is still saving it", async () => {
    query(null);
    query({ count: 10 });
    query(null, { code: "23505" });
    query({ id: 42, raw_text: null });

    expect(
      await createPicturebookAction(input, "token", requestId),
    ).toMatchObject({
      ok: false,
      retrySameRequest: true,
      retryable: true,
    });
    expect(
      mocks.rpc.mock.calls.filter(([name]) => name === "consume_beads"),
    ).toHaveLength(0);
  });

  it("keeps recovery retryable while the reserved book is not saved yet", async () => {
    query({ id: 42, raw_text: null });
    query({ count: 9 });

    expect(
      await createPicturebookAction(input, "token", requestId),
    ).toMatchObject({
      ok: false,
      retrySameRequest: true,
      retryable: true,
    });
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "keeps the same request if the recovery lookup also fails (throws: %s)",
    async reject => {
      query(null);
      query({ count: 10 });
      query(null, new Error("INSERT response lost"));
      query(null, new Error("recovery read unavailable"), reject);

      expect(
        await createPicturebookAction(input, "token", requestId),
      ).toMatchObject({ ok: false, retrySameRequest: true });
      expect(
        mocks.rpc.mock.calls.filter(([name]) => name === "consume_beads"),
      ).toHaveLength(0);
      expect(mocks.adminRpc).not.toHaveBeenCalled();
    },
  );

  it.each([null, "9", -1])(
    "does not return an invented balance from recovery: %s",
    async count => {
      query(null);
      query({ count: 10 });
      query(null, { code: "23505" });
      query({ id: 42, raw_text: JSON.stringify(book()) });
      query({ count });

      expect(
        await createPicturebookAction(input, "token", requestId),
      ).toMatchObject({ ok: false, retrySameRequest: true });
      expect(mocks.adminRpc).not.toHaveBeenCalled();
    },
  );
});
