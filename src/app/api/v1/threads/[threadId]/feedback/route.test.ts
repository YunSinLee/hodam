import { NextRequest } from "next/server";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  client: vi.fn(),
  ownThread: vi.fn(),
  parseBook: vi.fn(),
  rateLimit: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
}));
vi.mock("@/lib/auth/request-auth", () => ({
  authenticateRequest: mocks.authenticate,
  requireUserClient: mocks.client,
}));
vi.mock("@/lib/server/hodam-repo", () => ({
  getThreadForUser: mocks.ownThread,
}));
vi.mock("@/app/utils/picturebook", () => ({
  parsePicturebookDraft: mocks.parseBook,
}));
vi.mock("@/lib/server/rate-limit", () => ({ checkRateLimit: mocks.rateLimit }));

const savedRow = {
  rating: "again",
  reason: "story",
  updated_at: "2026-10-08T00:00:00+00:00",
};
const client = { rpc: mocks.rpc, from: mocks.from };
const query = {
  select: mocks.select,
  eq: mocks.eq,
  maybeSingle: mocks.maybeSingle,
};

function request(body?: unknown, ownerId = "owner-1") {
  return new NextRequest("http://localhost/api/v1/threads/752/feedback", {
    method: body === undefined ? "GET" : "PUT",
    headers: {
      "x-hodam-owner-id": ownerId,
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function context(threadId = "752") {
  return { params: Promise.resolve({ threadId }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authenticate.mockResolvedValue({
    userId: "owner-1",
    accessToken: "token",
  });
  mocks.client.mockReturnValue(client);
  mocks.ownThread.mockResolvedValue({
    id: 752,
    user_id: "owner-1",
    raw_text: "owned-book",
  });
  mocks.parseBook.mockReturnValue({ status: "complete" });
  mocks.rateLimit.mockReturnValue(true);
  mocks.from.mockReturnValue(query);
  mocks.select.mockReturnValue(query);
  mocks.eq.mockReturnValue(query);
  mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
  mocks.rpc.mockResolvedValue({ data: [savedRow], error: null });
});

describe("owned reading feedback API", () => {
  it("requires authentication for reading and writing", async () => {
    const { GET, PUT } = await import("./route");
    mocks.authenticate.mockResolvedValue(null);
    expect((await GET(request(), context())).status).toBe(401);
    expect((await PUT(request({ rating: "again" }), context())).status).toBe(
      401,
    );
    expect(mocks.client).not.toHaveBeenCalled();
  });

  it("rejects a stale account's pending screen", async () => {
    const { PUT } = await import("./route");
    const response = await PUT(
      request({ rating: "again" }, "old-owner"),
      context(),
    );
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("AUTH_OWNER_CHANGED");
    expect(mocks.ownThread).not.toHaveBeenCalled();
  });

  it.each(["-1", "0", "1.5", "1e3", "9007199254740992"])(
    "rejects invalid book ID %s",
    async threadId => {
      const { GET } = await import("./route");
      expect((await GET(request(), context(threadId))).status).toBe(400);
      expect(mocks.ownThread).not.toHaveBeenCalled();
    },
  );

  it("checks ownership before reading or storing a response", async () => {
    const { GET, PUT } = await import("./route");
    mocks.ownThread.mockRejectedValue(new Error("THREAD_NOT_FOUND"));
    expect((await GET(request(), context())).status).toBe(404);
    expect((await PUT(request({ rating: "again" }), context())).status).toBe(
      404,
    );
    expect(mocks.ownThread).toHaveBeenCalledWith(client, 752, "owner-1");
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("returns a private uncached response without exposing the book or user", async () => {
    const { GET } = await import("./route");
    mocks.maybeSingle.mockResolvedValue({ data: savedRow, error: null });
    const response = await GET(request(), context());
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      feedback: {
        rating: "again",
        reason: "story",
        updatedAt: savedRow.updated_at,
      },
    });
    expect(mocks.eq).toHaveBeenCalledWith("thread_id", 752);
    expect(mocks.eq).toHaveBeenCalledWith("user_id", "owner-1");
    expect(mocks.client).toHaveBeenCalledWith("token");
  });

  it("reports no previous response accurately", async () => {
    const { GET } = await import("./route");
    expect(await (await GET(request(), context())).json()).toEqual({
      feedback: null,
    });
  });

  it.each([
    { rating: "again", reason: "length" },
    { rating: "again", title: "private title" },
    { rating: "disappointed", reason: "personalization" },
  ])("rejects invalid response %j before touching storage", async body => {
    const { PUT } = await import("./route");
    expect((await PUT(request(body), context())).status).toBe(400);
    expect(mocks.ownThread).not.toHaveBeenCalled();
  });

  it("does not accept feedback for unfinished or legacy books", async () => {
    const { PUT } = await import("./route");
    mocks.parseBook.mockReturnValue(null);
    expect((await PUT(request({ rating: "again" }), context())).status).toBe(
      409,
    );
    mocks.parseBook.mockReturnValue({ status: "choice-ready" });
    expect((await PUT(request({ rating: "again" }), context())).status).toBe(
      409,
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("uses the same idempotent book upsert for retries and changes", async () => {
    const { PUT } = await import("./route");
    expect((await PUT(request({ rating: "again" }), context())).status).toBe(
      200,
    );
    expect(
      (
        await PUT(
          request({ rating: "disappointed", reason: "language" }),
          context(),
        )
      ).status,
    ).toBe(200);
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "save_reading_feedback", {
      p_thread_id: 752,
      p_rating: "again",
      p_reason: null,
    });
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "save_reading_feedback", {
      p_thread_id: 752,
      p_rating: "disappointed",
      p_reason: "language",
    });
  });

  it("limits response spam", async () => {
    const { PUT } = await import("./route");
    mocks.rateLimit.mockReturnValue(false);
    expect((await PUT(request({ rating: "again" }), context())).status).toBe(
      429,
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    { data: null, error: { code: "42P01", message: "migration missing" } },
    { data: [], error: null },
  ])("does not claim success when persistence is unavailable", async result => {
    const { PUT } = await import("./route");
    mocks.rpc.mockResolvedValue(result);
    const response = await PUT(request({ rating: "again" }), context());
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("FEEDBACK_UNAVAILABLE");
  });
});
