// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ReadingStateBook,
  ReadingStateInput,
} from "@/lib/picturebook/reading-state";

import readingStateApi from "./api/reading-state";
import { setBookFavorite, saveReadingProgress } from "./reading-library";
import { ReadingSyncEngine } from "./reading-sync";

vi.mock("./api/reading-state", () => ({
  default: { list: vi.fn(), save: vi.fn() },
}));

const now = "2026-10-08T03:00:00.000Z";
function book(threadId: number, favoriteVersion = 0): ReadingStateBook {
  return {
    threadId,
    favorite: false,
    favoriteVersion,
    progress: null,
    progressVersion: 0,
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function online(value: boolean) {
  Object.defineProperty(navigator, "onLine", { value, configurable: true });
}
const stops: (() => void)[] = [];
let server: Record<string, ReadingStateBook>;
function open(ownerId = "owner-a") {
  const engine = new ReadingSyncEngine(ownerId);
  stops.push(engine.subscribe(() => {}));
  return engine;
}
async function ready(engine: ReadingSyncEngine) {
  await vi.waitFor(() => expect(engine.getSnapshot().status).toBe("synced"));
}
function apply(bookId: number, input: ReadingStateInput) {
  const current = server[bookId] || book(bookId);
  const currentVersion =
    input.field === "favorite"
      ? current.favoriteVersion
      : current.progressVersion;
  if (input.expectedVersion !== currentVersion)
    return { book: current, applied: false };
  const next =
    input.field === "favorite"
      ? {
          ...current,
          favorite: input.favorite,
          favoriteVersion: current.favoriteVersion + 1,
        }
      : {
          ...current,
          progress: { ...input.progress, updatedAt: now },
          progressVersion: current.progressVersion + 1,
        };
  server[bookId] = next;
  return { book: next, applied: true };
}

describe("reading account synchronization", () => {
  beforeEach(() => {
    window.localStorage.clear();
    online(true);
    server = {};
    vi.mocked(readingStateApi.list)
      .mockReset()
      .mockImplementation(async () => ({
        books: Object.values(server),
        nextCursor: null,
      }));
    vi.mocked(readingStateApi.save)
      .mockReset()
      .mockImplementation(async (_owner, bookId, input) =>
        apply(bookId, input),
      );
  });
  afterEach(() => {
    stops.splice(0).forEach(stop => stop());
    vi.restoreAllMocks();
  });

  it("shares one load for multiple subscribers and paginates all server state", async () => {
    const engine = new ReadingSyncEngine("owner-a");
    vi.mocked(readingStateApi.list)
      .mockResolvedValueOnce({
        books: [{ ...book(1, 1), favorite: true }],
        nextCursor: 1,
      })
      .mockResolvedValueOnce({ books: [book(2, 4)], nextCursor: null });
    stops.push(
      engine.subscribe(() => {}),
      engine.subscribe(() => {}),
    );
    await ready(engine);
    expect(readingStateApi.list).toHaveBeenCalledTimes(2);
    expect(vi.mocked(readingStateApi.list).mock.calls[1][1]).toBe(1);
    expect(engine.getSnapshot().books[1].favorite).toBe(true);
    expect(engine.getSnapshot().books[2]).toEqual({});
  });

  it("rebases rapid local changes after its own successful write without losing the newest page", async () => {
    const engine = open();
    await ready(engine);
    const first = deferred<{ book: ReadingStateBook; applied: boolean }>();
    vi.mocked(readingStateApi.save).mockImplementationOnce(() => first.promise);
    engine.saveProgress(11, { pageIndex: 2, pageCount: 8, completed: false });
    await vi.waitFor(() =>
      expect(readingStateApi.save).toHaveBeenCalledTimes(1),
    );
    engine.saveProgress(11, { pageIndex: 4, pageCount: 8, completed: false });
    engine.setFavorite(11, true);
    expect(engine.getSnapshot().books[11].pageIndex).toBe(4);
    first.resolve(
      apply(11, {
        field: "progress",
        expectedVersion: 0,
        progress: { pageIndex: 2, pageCount: 8, completed: false },
      }),
    );
    await ready(engine);
    const inputs = vi
      .mocked(readingStateApi.save)
      .mock.calls.map(call => call[2]);
    expect(inputs).toEqual([
      {
        field: "progress",
        expectedVersion: 0,
        progress: { pageIndex: 2, pageCount: 8, completed: false },
      },
      {
        field: "progress",
        expectedVersion: 1,
        progress: { pageIndex: 4, pageCount: 8, completed: false },
      },
      { field: "favorite", expectedVersion: 0, favorite: true },
    ]);
    expect(engine.getSnapshot().books[11]).toMatchObject({
      pageIndex: 4,
      favorite: true,
    });
  });

  it("shows remote conflict values and does not overwrite them with a queued later page", async () => {
    const engine = open();
    await ready(engine);
    const response = deferred<{ book: ReadingStateBook; applied: boolean }>();
    vi.mocked(readingStateApi.save).mockImplementationOnce(
      () => response.promise,
    );
    engine.saveProgress(11, { pageIndex: 2, pageCount: 8, completed: false });
    await vi.waitFor(() =>
      expect(readingStateApi.save).toHaveBeenCalledTimes(1),
    );
    engine.saveProgress(11, { pageIndex: 4, pageCount: 8, completed: false });
    response.resolve({
      book: {
        ...book(11),
        progressVersion: 3,
        progress: {
          pageIndex: 6,
          pageCount: 8,
          completed: true,
          updatedAt: now,
        },
      },
      applied: false,
    });
    await vi.waitFor(() =>
      expect(engine.getSnapshot().status).toBe("conflict"),
    );
    expect(engine.getSnapshot().pendingCount).toBe(0);
    expect(engine.getSnapshot().books[11]).toMatchObject({
      pageIndex: 6,
      completedAt: Date.parse(now),
    });
    expect(readingStateApi.save).toHaveBeenCalledTimes(1);
  });

  it("does not let an older background GET replace a newer successful PUT", async () => {
    server[11] = book(11, 1);
    const engine = open();
    await ready(engine);
    const write = deferred<{ book: ReadingStateBook; applied: boolean }>();
    const read = deferred<{
      books: ReadingStateBook[];
      nextCursor: number | null;
    }>();
    vi.mocked(readingStateApi.save).mockImplementationOnce(() => write.promise);
    vi.mocked(readingStateApi.list).mockImplementationOnce(() => read.promise);
    engine.setFavorite(11, true);
    await vi.waitFor(() =>
      expect(readingStateApi.save).toHaveBeenCalledTimes(1),
    );
    window.dispatchEvent(new Event("focus"));
    write.resolve(
      apply(11, { field: "favorite", expectedVersion: 1, favorite: true }),
    );
    await vi.waitFor(() => expect(engine.getSnapshot().pendingCount).toBe(0));
    read.resolve({ books: [book(11, 1)], nextCursor: null });
    await ready(engine);
    expect(engine.getSnapshot().books[11].favorite).toBe(true);
  });

  it("keeps offline intent durable, restores it, and acknowledges a lost success response", async () => {
    online(false);
    const engine = open();
    engine.setFavorite(11, true);
    expect(engine.getSnapshot()).toMatchObject({
      status: "offline",
      pendingCount: 1,
    });
    expect(readingStateApi.list).not.toHaveBeenCalled();
    stops.pop()!();
    server[11] = { ...book(11, 1), favorite: true };
    online(true);
    const restored = open();
    await ready(restored);
    expect(restored.getSnapshot().pendingCount).toBe(0);
    expect(restored.getSnapshot().books[11].favorite).toBe(true);
    expect(
      vi.mocked(readingStateApi.save).mock.calls[0][2].expectedVersion,
    ).toBe(0);
  });

  it("retains failed writes and retries only after an explicit retry or reconnect", async () => {
    const engine = open();
    await ready(engine);
    vi.mocked(readingStateApi.save).mockRejectedValueOnce(
      new Error("network failed"),
    );
    engine.setFavorite(11, true);
    await vi.waitFor(() => expect(engine.getSnapshot().status).toBe("error"));
    expect(engine.getSnapshot().pendingCount).toBe(1);
    expect(readingStateApi.save).toHaveBeenCalledTimes(1);
    engine.retry();
    await ready(engine);
    expect(readingStateApi.save).toHaveBeenCalledTimes(2);
    expect(engine.getSnapshot().pendingCount).toBe(0);
  });

  it("isolates a late account response and aborts when its final subscriber leaves", async () => {
    const oldRead = deferred<{
      books: ReadingStateBook[];
      nextCursor: number | null;
    }>();
    vi.mocked(readingStateApi.list).mockImplementationOnce(
      () => oldRead.promise,
    );
    const old = open("owner-a");
    const signal = vi.mocked(readingStateApi.list).mock.calls[0][2];
    stops.pop()!();
    expect(signal?.aborted).toBe(true);
    const next = open("owner-b");
    await ready(next);
    oldRead.resolve({
      books: [{ ...book(11, 5), favorite: true }],
      nextCursor: null,
    });
    await Promise.resolve();
    expect(next.getSnapshot().books).toEqual({});
    expect(old.getSnapshot().books).toEqual({});
  });

  it("keeps an owner-mismatch response pending instead of discarding the original account's intent", async () => {
    const engine = open();
    await ready(engine);
    vi.mocked(readingStateApi.save).mockRejectedValueOnce({
      status: 409,
      code: "AUTH_OWNER_CHANGED",
    });
    engine.setFavorite(11, true);
    await vi.waitFor(() => expect(engine.getSnapshot().status).toBe("error"));
    expect(engine.getSnapshot().pendingCount).toBe(1);
    expect(readingStateApi.save).toHaveBeenCalledTimes(1);
  });

  it("does not upload legacy records until explicitly asked and never replaces nonempty remote fields", async () => {
    setBookFavorite("owner-a", 11, true);
    saveReadingProgress("owner-a", 11, {
      pageIndex: 2,
      pageCount: 4,
      completed: false,
    });
    server[11] = book(11, 3); // A deliberate remote unfavorite must win over v1.
    const engine = open();
    await ready(engine);
    expect(readingStateApi.save).not.toHaveBeenCalled();
    expect(engine.getSnapshot()).toMatchObject({
      legacyCount: 1,
      localOnlyCount: 1,
    });
    expect(engine.getSnapshot().books[11].favorite).toBeUndefined();
    engine.dismissLegacy();
    expect(engine.getSnapshot()).toMatchObject({
      legacyCount: 0,
      localOnlyCount: 1,
    });
    engine.importLegacy();
    await ready(engine);
    expect(readingStateApi.save).toHaveBeenCalledTimes(1);
    expect(vi.mocked(readingStateApi.save).mock.calls[0][2]).toMatchObject({
      field: "progress",
      expectedVersion: 0,
    });
    expect(engine.getSnapshot().localOnlyCount).toBe(0);
  });

  it("waits for authoritative state before importing old local records", async () => {
    setBookFavorite("owner-a", 11, true);
    const read = deferred<{
      books: ReadingStateBook[];
      nextCursor: number | null;
    }>();
    vi.mocked(readingStateApi.list).mockImplementationOnce(() => read.promise);
    const engine = open();
    engine.importLegacy();
    expect(readingStateApi.save).not.toHaveBeenCalled();
    read.resolve({ books: [book(11, 2)], nextCursor: null });
    await ready(engine);
    expect(engine.getSnapshot().books[11].favorite).toBeUndefined();
    expect(readingStateApi.save).not.toHaveBeenCalled();
  });

  it("continues importing other books after a deleted legacy book and does not loop on it", async () => {
    setBookFavorite("owner-a", 11, true);
    setBookFavorite("owner-a", 12, true);
    const engine = open();
    await ready(engine);
    vi.mocked(readingStateApi.save).mockRejectedValueOnce({ status: 404 });
    engine.importLegacy();
    await vi.waitFor(() => expect(engine.getSnapshot().pendingCount).toBe(0));
    expect(readingStateApi.save).toHaveBeenCalledTimes(2);
    expect(engine.getSnapshot().books[12].favorite).toBe(true);
    expect(engine.getSnapshot().books[11]).toBeUndefined();
    expect(engine.getSnapshot().status).toBe("error");
  });

  it("keeps optimistic values in memory and can save online when browser storage is blocked", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const engine = open();
    await ready(engine);
    expect(engine.setFavorite(11, true)).toBe(true);
    expect(engine.getSnapshot().books[11].favorite).toBe(true);
    await ready(engine);
    expect(engine.getSnapshot()).toMatchObject({
      storageAvailable: false,
      pendingCount: 0,
    });
    expect(server[11].favorite).toBe(true);
  });

  it("merges a newer other-tab cache without touching another account's pending writes", async () => {
    server[11] = book(11, 1);
    const engine = open();
    await ready(engine);
    window.localStorage.setItem(
      "hodam-reading-sync:v2:owner-b:cache",
      JSON.stringify([{ ...book(11, 9), favorite: true }]),
    );
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "hodam-reading-sync:v2:owner-b:cache",
      }),
    );
    expect(engine.getSnapshot().books[11].favorite).toBeUndefined();
    window.localStorage.setItem(
      "hodam-reading-sync:v2:owner-a:cache",
      JSON.stringify([{ ...book(11, 2), favorite: true }]),
    );
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "hodam-reading-sync:v2:owner-a:cache",
      }),
    );
    expect(engine.getSnapshot().books[11].favorite).toBe(true);
  });

  it("preserves a new other-tab record received after an older empty GET began", async () => {
    const read = deferred<{
      books: ReadingStateBook[];
      nextCursor: number | null;
    }>();
    vi.mocked(readingStateApi.list).mockImplementationOnce(() => read.promise);
    const engine = open();
    window.localStorage.setItem(
      "hodam-reading-sync:v2:owner-a:cache",
      JSON.stringify([{ ...book(99, 1), favorite: true }]),
    );
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "hodam-reading-sync:v2:owner-a:cache",
      }),
    );
    read.resolve({ books: [], nextCursor: null });
    await ready(engine);
    expect(engine.getSnapshot().books[99].favorite).toBe(true);
  });

  it("clears a previous fetch error when remounting and successfully refreshing", async () => {
    vi.mocked(readingStateApi.list).mockRejectedValueOnce(
      new Error("temporary"),
    );
    const engine = open();
    await vi.waitFor(() => expect(engine.getSnapshot().status).toBe("error"));
    stops.pop()!();
    stops.push(engine.subscribe(() => {}));
    await ready(engine);
  });

  it("establishes the baseline once for a fresh click during the first uncached read", async () => {
    const read = deferred<{
      books: ReadingStateBook[];
      nextCursor: number | null;
    }>();
    vi.mocked(readingStateApi.list).mockImplementationOnce(() => read.promise);
    const engine = open();
    engine.setFavorite(11, true);
    engine.saveProgress(11, { pageIndex: 2, pageCount: 8, completed: false });
    engine.saveProgress(11, { pageIndex: 4, pageCount: 8, completed: false });
    server[11] = {
      ...book(11, 3),
      progressVersion: 2,
      progress: {
        pageIndex: 1,
        pageCount: 8,
        completed: false,
        updatedAt: now,
      },
    };
    read.resolve({ books: [server[11]], nextCursor: null });
    await ready(engine);
    expect(
      vi
        .mocked(readingStateApi.save)
        .mock.calls.map(call => call[2].expectedVersion),
    ).toEqual([3, 2]);
    expect(engine.getSnapshot().books[11]).toMatchObject({
      favorite: true,
      pageIndex: 4,
    });
  });

  it("never rebases cached or restored intent just because a fresh GET has a newer version", async () => {
    window.localStorage.setItem(
      "hodam-reading-sync:v2:owner-a:cache",
      JSON.stringify([book(11, 1)]),
    );
    const read = deferred<{
      books: ReadingStateBook[];
      nextCursor: number | null;
    }>();
    vi.mocked(readingStateApi.list).mockImplementationOnce(() => read.promise);
    const engine = open();
    engine.setFavorite(11, true);
    server[11] = book(11, 3);
    read.resolve({ books: [server[11]], nextCursor: null });
    await vi.waitFor(() =>
      expect(engine.getSnapshot().status).toBe("conflict"),
    );
    expect(
      vi.mocked(readingStateApi.save).mock.calls[0][2].expectedVersion,
    ).toBe(1);
    expect(engine.getSnapshot().books[11].favorite).toBeUndefined();
  });

  it("does not persist unknown-baseline permission across a restart", async () => {
    const read = deferred<{
      books: ReadingStateBook[];
      nextCursor: number | null;
    }>();
    vi.mocked(readingStateApi.list).mockImplementationOnce(() => read.promise);
    const engine = open();
    engine.setFavorite(11, true);
    stops.pop()!();
    server[11] = book(11, 4);
    const restored = open();
    await vi.waitFor(() =>
      expect(restored.getSnapshot().status).toBe("conflict"),
    );
    expect(
      vi.mocked(readingStateApi.save).mock.calls[0][2].expectedVersion,
    ).toBe(0);
    expect(restored.getSnapshot().books[11].favorite).toBeUndefined();
    read.resolve({ books: [], nextCursor: null });
  });

  it("does not carry unknown-baseline permission into a retry after the initial GET fails", async () => {
    const read = deferred<{
      books: ReadingStateBook[];
      nextCursor: number | null;
    }>();
    vi.mocked(readingStateApi.list).mockImplementationOnce(() => read.promise);
    const engine = open();
    engine.setFavorite(11, true);
    read.reject(new Error("offline"));
    await vi.waitFor(() => expect(engine.getSnapshot().status).toBe("error"));
    server[11] = book(11, 2);
    engine.retry();
    await vi.waitFor(() =>
      expect(engine.getSnapshot().status).toBe("conflict"),
    );
    expect(
      vi.mocked(readingStateApi.save).mock.calls[0][2].expectedVersion,
    ).toBe(0);
  });

  it.each(["READING_BOOK_INVALID", "READING_STATE_VERSION_EXHAUSTED"])(
    "does not block the remaining import queue on terminal %s",
    async code => {
      setBookFavorite("owner-a", 11, true);
      setBookFavorite("owner-a", 12, true);
      const engine = open();
      await ready(engine);
      vi.mocked(readingStateApi.save).mockRejectedValueOnce({
        status: 409,
        code,
      });
      engine.importLegacy();
      await vi.waitFor(() => expect(engine.getSnapshot().pendingCount).toBe(0));
      expect(readingStateApi.save).toHaveBeenCalledTimes(2);
      expect(engine.getSnapshot().books[12].favorite).toBe(true);
      expect(engine.getSnapshot().localOnlyCount).toBe(0);
      engine.importLegacy();
      await Promise.resolve();
      expect(readingStateApi.save).toHaveBeenCalledTimes(2);
    },
  );

  it("uses the original first-GET baseline instead of rebasing over a later other-tab change", async () => {
    const read = deferred<{
      books: ReadingStateBook[];
      nextCursor: number | null;
    }>();
    vi.mocked(readingStateApi.list).mockImplementationOnce(() => read.promise);
    const engine = open();
    engine.setFavorite(11, true);
    server[11] = book(11, 4);
    window.localStorage.setItem(
      "hodam-reading-sync:v2:owner-a:cache",
      JSON.stringify([server[11]]),
    );
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "hodam-reading-sync:v2:owner-a:cache",
      }),
    );
    read.resolve({
      books: [{ ...book(11, 3), favorite: true }],
      nextCursor: null,
    });
    await vi.waitFor(() =>
      expect(engine.getSnapshot().status).toBe("conflict"),
    );
    expect(
      vi.mocked(readingStateApi.save).mock.calls[0][2].expectedVersion,
    ).toBe(3);
    expect(engine.getSnapshot().books[11].favorite).toBeUndefined();
    expect(server[11].favorite).toBe(false);
  });

  it("reads another tab's latest cache before committing a GET even if its storage event is delayed", async () => {
    const read = deferred<{
      books: ReadingStateBook[];
      nextCursor: number | null;
    }>();
    vi.mocked(readingStateApi.list).mockImplementationOnce(() => read.promise);
    const engine = open();
    window.localStorage.setItem(
      "hodam-reading-sync:v2:owner-a:cache",
      JSON.stringify([{ ...book(99, 1), favorite: true }]),
    );
    read.resolve({ books: [], nextCursor: null });
    await ready(engine);
    expect(engine.getSnapshot().books[99].favorite).toBe(true);
    expect(
      JSON.parse(
        window.localStorage.getItem("hodam-reading-sync:v2:owner-a:cache")!,
      ),
    ).toMatchObject([{ threadId: 99, favorite: true }]);
  });
});
