import { NextRequest } from "next/server";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  client: vi.fn(),
  ownThread: vi.fn(),
  parseBook: vi.fn(),
  rateLimit: vi.fn(),
  rpc: vi.fn(),
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

const client = { rpc: mocks.rpc };
const savedRow = {
  applied: true,
  thread_id: 752,
  favorite: true,
  favorite_version: 1,
  page_index: null,
  page_count: null,
  completed: false,
  progress_updated_at: null,
  progress_version: 0,
};
const favoriteInput = { field: "favorite", expectedVersion: 0, favorite: true };
function progressInput(pageIndex = 2, pageCount = 8, completed = false) {
  return {
    field: "progress",
    expectedVersion: 0,
    progress: { pageIndex, pageCount, completed },
  };
}
function request(
  body: unknown = favoriteInput,
  owner: string | null = "owner-1",
) {
  return new NextRequest("http://localhost/api/v1/threads/752/reading-state", {
    method: "PUT",
    headers: owner === null ? {} : { "x-hodam-owner-id": owner },
    body: JSON.stringify(body),
  });
}
function context(threadId = "752") {
  return { params: Promise.resolve({ threadId }) };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.authenticate.mockResolvedValue({
    userId: "owner-1",
    accessToken: "user-token",
  });
  mocks.client.mockReturnValue(client);
  mocks.ownThread.mockResolvedValue({
    id: 752,
    user_id: "owner-1",
    raw_text: "private-book-content",
  });
  mocks.parseBook.mockReturnValue({
    status: "complete",
    pages: Array.from({ length: 8 }, () => ({})),
  });
  mocks.rateLimit.mockReturnValue(true);
  mocks.rpc.mockResolvedValue({ data: [savedRow], error: null });
});

describe("reading-state compare-and-set API", () => {
  it("requires authentication and does not cache errors", async () => {
    const { PUT } = await import("./route");
    mocks.authenticate.mockResolvedValue(null);
    const response = await PUT(request(), context());
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it.each([
    [null, 400],
    ["stale-owner", 409],
  ] as const)(
    "requires the current owner header: %s",
    async (owner, expected) => {
      const { PUT } = await import("./route");
      expect((await PUT(request(favoriteInput, owner), context())).status).toBe(
        expected,
      );
      expect(mocks.ownThread).not.toHaveBeenCalled();
    },
  );
  it.each(["0", "-1", "1.1", "1e3", "9007199254740992"])(
    "rejects malformed book ID %s",
    async id => {
      const { PUT } = await import("./route");
      expect((await PUT(request(), context(id))).status).toBe(400);
      expect(mocks.ownThread).not.toHaveBeenCalled();
    },
  );
  it.each([
    { ...favoriteInput, expectedVersion: -1 },
    { ...favoriteInput, expectedVersion: 1.5 },
    { ...favoriteInput, expectedVersion: 2147483647 },
    { ...favoriteInput, userId: "other-user" },
    { ...favoriteInput, title: "private" },
    {
      ...favoriteInput,
      progress: { pageIndex: 0, pageCount: 8, completed: false },
    },
    progressInput(8, 8),
    progressInput(0, 101),
  ])("rejects invalid or extra input %j", async input => {
    const { PUT } = await import("./route");
    expect((await PUT(request(input), context())).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("checks owned book before CAS", async () => {
    const { PUT } = await import("./route");
    mocks.ownThread.mockRejectedValue(new Error("THREAD_NOT_FOUND"));
    expect((await PUT(request(), context())).status).toBe(404);
    expect(mocks.ownThread).toHaveBeenCalledWith(client, 752, "owner-1");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects legacy books", async () => {
    const { PUT } = await import("./route");
    mocks.parseBook.mockReturnValue(null);
    expect((await PUT(request(), context())).status).toBe(409);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("sends only the favorite field and expected version", async () => {
    const { PUT } = await import("./route");
    const response = await PUT(request(), context());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.rpc).toHaveBeenCalledWith("save_reading_state", {
      p_thread_id: 752,
      p_field: "favorite",
      p_expected_version: 0,
      p_favorite: true,
      p_page_index: null,
      p_page_count: null,
      p_completed: null,
    });
    expect(await response.json()).toEqual({
      applied: true,
      book: {
        threadId: 752,
        favorite: true,
        favoriteVersion: 1,
        progress: null,
        progressVersion: 0,
      },
    });
  });
  it("returns the authoritative row on a stale write without retrying it", async () => {
    const { PUT } = await import("./route");
    mocks.rpc.mockResolvedValue({
      data: [
        { ...savedRow, applied: false, favorite: false, favorite_version: 3 },
      ],
      error: null,
    });
    const response = await PUT(request(), context());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      applied: false,
      book: {
        threadId: 752,
        favorite: false,
        favoriteVersion: 3,
        progress: null,
        progressVersion: 0,
      },
    });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it.each([false, true])(
    "normalizes an earlier 4-page bookmark into the 8-page book, completed=%s",
    async completed => {
      const { PUT } = await import("./route");
      await PUT(request(progressInput(3, 4, completed)), context());
      expect(mocks.rpc).toHaveBeenCalledWith("save_reading_state", {
        p_thread_id: 752,
        p_field: "progress",
        p_expected_version: 0,
        p_favorite: null,
        p_page_index: 3,
        p_page_count: 8,
        p_completed: false,
      });
    },
  );
  it("rejects a bookmark claiming more pages than the actual book", async () => {
    const { PUT } = await import("./route");
    mocks.parseBook.mockReturnValue({
      status: "choice-ready",
      pages: [{}, {}, {}, {}],
    });
    const response = await PUT(request(progressInput(2, 8)), context());
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("READING_BOOK_CHANGED");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([6, 7])(
    "accepts desktop/mobile last-page completion at index %s",
    async index => {
      const { PUT } = await import("./route");
      expect(
        (await PUT(request(progressInput(index, 8, true)), context())).status,
      ).toBe(200);
      expect(mocks.rpc.mock.calls[0][1].p_completed).toBe(true);
    },
  );
  it("rejects early completion and completion of a draft", async () => {
    const { PUT } = await import("./route");
    expect(
      (await PUT(request(progressInput(2, 8, true)), context())).status,
    ).toBe(409);
    mocks.parseBook.mockReturnValue({
      status: "choice-ready",
      pages: [{}, {}, {}, {}],
    });
    expect(
      (await PUT(request(progressInput(3, 4, true)), context())).status,
    ).toBe(409);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rate limits update attempts", async () => {
    const { PUT } = await import("./route");
    mocks.rateLimit.mockReturnValue(false);
    expect((await PUT(request(), context())).status).toBe(429);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([
    { data: null, error: { message: "table missing" } },
    { data: [], error: null },
  ])(
    "returns unavailable instead of falsely confirming persistence",
    async result => {
      const { PUT } = await import("./route");
      mocks.rpc.mockResolvedValue(result);
      expect((await PUT(request(), context())).status).toBe(503);
    },
  );
});
