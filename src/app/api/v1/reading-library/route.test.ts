import { NextRequest } from "next/server";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  client: vi.fn(),
  rateLimit: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  gt: vi.fn(),
  order: vi.fn(),
  limit: vi.fn(),
}));
vi.mock("@/lib/auth/request-auth", () => ({
  authenticateRequest: mocks.authenticate,
  requireUserClient: mocks.client,
}));
vi.mock("@/lib/server/rate-limit", () => ({ checkRateLimit: mocks.rateLimit }));
const query = {
  select: mocks.select,
  eq: mocks.eq,
  gt: mocks.gt,
  order: mocks.order,
  limit: mocks.limit,
};

function row(id: number) {
  return {
    thread_id: id,
    favorite: false,
    favorite_version: 0,
    page_index: null,
    page_count: null,
    completed: false,
    progress_updated_at: null,
    progress_version: 0,
  };
}
function request(queryString = "", owner: string | null = "owner-1") {
  return new NextRequest(
    `http://localhost/api/v1/reading-library${queryString}`,
    {
      headers: owner === null ? {} : { "x-hodam-owner-id": owner },
    },
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.authenticate.mockResolvedValue({
    userId: "owner-1",
    accessToken: "user-token",
  });
  mocks.client.mockReturnValue({ from: mocks.from });
  mocks.rateLimit.mockReturnValue(true);
  mocks.from.mockReturnValue(query);
  mocks.select.mockReturnValue(query);
  mocks.eq.mockReturnValue(query);
  mocks.gt.mockReturnValue(query);
  mocks.order.mockReturnValue(query);
  mocks.limit.mockResolvedValue({ data: [], error: null });
});

describe("reading library cursor API", () => {
  it("requires authentication before querying", async () => {
    const { GET } = await import("./route");
    mocks.authenticate.mockResolvedValue(null);
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it.each([
    [null, 400],
    ["different-owner", 409],
  ] as const)("rejects missing or stale owner %s", async (owner, status) => {
    const { GET } = await import("./route");
    expect((await GET(request("", owner))).status).toBe(status);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it.each([
    "?after=0",
    "?after=-1",
    "?after=1.5",
    "?after=1e3",
    "?after=9007199254740992",
    "?after=",
    "?after=1&after=2",
  ])("rejects invalid cursor %s", async cursor => {
    const { GET } = await import("./route");
    expect((await GET(request(cursor))).status).toBe(400);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("returns only 200 ascending records and a last-visible-row cursor", async () => {
    const { GET } = await import("./route");
    mocks.limit.mockResolvedValue({
      data: Array.from({ length: 201 }, (_, i) => row(i + 101)),
      error: null,
    });
    const response = await GET(request("?after=100"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(body.books).toHaveLength(200);
    expect(body.books[0].threadId).toBe(101);
    expect(body.books[199].threadId).toBe(300);
    expect(body.nextCursor).toBe(300);
    expect(mocks.client).toHaveBeenCalledWith("user-token");
    expect(mocks.eq).toHaveBeenCalledWith("user_id", "owner-1");
    expect(mocks.gt).toHaveBeenCalledWith("thread_id", 100);
    expect(mocks.order).toHaveBeenCalledWith("thread_id", { ascending: true });
    expect(mocks.limit).toHaveBeenCalledWith(201);
    expect(JSON.stringify(body)).not.toContain("owner-1");
  });
  it("returns a terminal cursor even when the final page has exactly 200 rows", async () => {
    const { GET } = await import("./route");
    mocks.limit.mockResolvedValue({
      data: Array.from({ length: 200 }, (_, i) => row(i + 1)),
      error: null,
    });
    const body = await (await GET(request())).json();
    expect(body.nextCursor).toBeNull();
    expect(mocks.gt).toHaveBeenCalledWith("thread_id", 0);
  });
  it("distinguishes an empty library from storage failure", async () => {
    const { GET } = await import("./route");
    expect(await (await GET(request())).json()).toEqual({
      books: [],
      nextCursor: null,
    });
    mocks.limit.mockResolvedValue({
      data: null,
      error: { message: "table unavailable" },
    });
    expect((await GET(request())).status).toBe(503);
  });
  it("rejects malformed rows rather than syncing corrupt state", async () => {
    const { GET } = await import("./route");
    mocks.limit.mockResolvedValue({
      data: [{ ...row(1), page_index: 8, page_count: 8 }],
      error: null,
    });
    expect((await GET(request())).status).toBe(503);
  });
  it("rate limits requests", async () => {
    const { GET } = await import("./route");
    mocks.rateLimit.mockReturnValue(false);
    expect((await GET(request())).status).toBe(429);
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
