import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { book, input } from "./fixtures";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  generate: vi.fn(),
  adminRpc: vi.fn(),
  ready: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    rpc: (name: string, ...args: unknown[]) =>
      name === "picturebook_storage_ready"
        ? mocks.ready()
        : mocks.adminRpc(name, ...args),
  }),
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
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "synthetic-server-key");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase.test");
  mocks.ready.mockResolvedValue({ data: true, error: null });
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
afterEach(() => vi.unstubAllEnvs());

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
    "recovers the winning worker's saved book after atomic commit response loss (throws: %s)",
    async reject => {
      const winner = { ...book(), title: "먼저 저장된 그림책" };
      query(null);
      query({ count: 10 });
      // Reservation/INSERT handling moved into the transaction. The action now
      // retries that transaction, whose winner must remain authoritative.
      const lost = new Error("commit response lost");
      if (reject) mocks.adminRpc.mockRejectedValueOnce(lost);
      else mocks.adminRpc.mockResolvedValueOnce({ error: lost });
      mocks.adminRpc.mockResolvedValueOnce({
        data: [
          { thread_id: 42, raw_text: JSON.stringify(winner), bead_count: 9 },
        ],
      });

      expect(await createPicturebookAction(input, "token", requestId)).toEqual({
        ok: true,
        book: winner,
        threadId: 42,
        beadCount: 9,
      });
      expect(queries[0].steps).toContainEqual(["eq", ["user_id", "owner"]]);
      expect(queries[0].steps).toContainEqual([
        "eq",
        ["openai_thread_id", `picturebook_${requestId}`],
      ]);
      expect(
        mocks.rpc.mock.calls.filter(([name]) => name === "consume_beads"),
      ).toHaveLength(0);
      expect(mocks.adminRpc).toHaveBeenCalledTimes(2);
      expect(mocks.adminRpc.mock.calls[0]).toEqual(
        mocks.adminRpc.mock.calls[1],
      );
    },
  );

  it("retains the same request when the transaction reports unresolved legacy work", async () => {
    query(null);
    query({ count: 10 });
    mocks.adminRpc.mockResolvedValue({
      error: { message: "PICTUREBOOK_REQUEST_UNRESOLVED" },
    });

    expect(
      await createPicturebookAction(input, "token", requestId),
    ).toMatchObject({
      ok: false,
      retrySameRequest: true,
      retryable: false,
    });
    expect(
      mocks.rpc.mock.calls.filter(([name]) => name === "consume_beads"),
    ).toHaveLength(0);
  });

  it("preserves an unfinished legacy reservation for manual recovery without a new debit", async () => {
    query({ id: 42, raw_text: null });
    query({ count: 9 });

    expect(
      await createPicturebookAction(input, "token", requestId),
    ).toMatchObject({
      ok: false,
      retrySameRequest: true,
      retryable: false,
    });
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "keeps the same request if both commit responses are unavailable (throws: %s)",
    async reject => {
      query(null);
      query({ count: 10 });
      const unavailable = new Error("commit response unavailable");
      if (reject) mocks.adminRpc.mockRejectedValue(unavailable);
      else mocks.adminRpc.mockResolvedValue({ error: unavailable });

      expect(
        await createPicturebookAction(input, "token", requestId),
      ).toMatchObject({ ok: false, retrySameRequest: true });
      expect(
        mocks.rpc.mock.calls.filter(([name]) => name === "consume_beads"),
      ).toHaveLength(0);
      expect(mocks.adminRpc).toHaveBeenCalledTimes(2);
      expect(mocks.adminRpc.mock.calls[0]).toEqual(
        mocks.adminRpc.mock.calls[1],
      );
    },
  );

  it.each([null, "9", -1])(
    "does not return an invented balance from recovery: %s",
    async count => {
      query(null);
      query({ count: 10 });
      mocks.adminRpc.mockResolvedValue({
        data: [
          {
            thread_id: 42,
            raw_text: JSON.stringify(book()),
            bead_count: count,
          },
        ],
      });

      expect(
        await createPicturebookAction(input, "token", requestId),
      ).toMatchObject({ ok: false, retrySameRequest: true });
      expect(mocks.adminRpc).toHaveBeenCalledExactlyOnceWith(
        "commit_picturebook_start",
        expect.any(Object),
      );
    },
  );
});
