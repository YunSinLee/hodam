// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getReadingLibrary,
  saveReadingProgress,
  setBookFavorite,
  subscribeReadingLibrary,
} from "./reading-library";

describe("account-scoped reading library", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("stores only reading fields and separates accounts", () => {
    expect(setBookFavorite("owner-a", 11, true)).toBe(true);
    expect(
      saveReadingProgress("owner-a", 11, {
        pageIndex: 3,
        pageCount: 8,
        completed: false,
      }),
    ).toBe(true);
    expect(getReadingLibrary("owner-b")).toEqual({ books: {} });
    expect(getReadingLibrary("owner-a").books[11]).toMatchObject({
      favorite: true,
      pageIndex: 3,
      pageCount: 8,
    });
    expect(Object.keys(getReadingLibrary("owner-a").books[11]).sort()).toEqual([
      "favorite",
      "pageCount",
      "pageIndex",
      "updatedAt",
    ]);
    setBookFavorite("owner-a", 11, false);
    expect(getReadingLibrary("owner-a").books[11]).not.toHaveProperty(
      "favorite",
    );
    expect(getReadingLibrary("owner-a").books[11].pageIndex).toBe(3);
  });

  it("records completion and clears it only after another saved reading movement", () => {
    saveReadingProgress("owner-a", 11, {
      pageIndex: 6,
      pageCount: 8,
      completed: true,
    });
    expect(getReadingLibrary("owner-a").books[11].completedAt).toBeGreaterThan(
      0,
    );
    setBookFavorite("owner-a", 11, true);
    expect(getReadingLibrary("owner-a").books[11].completedAt).toBeGreaterThan(
      0,
    );
    saveReadingProgress("owner-a", 11, {
      pageIndex: 2,
      pageCount: 8,
      completed: false,
    });
    expect(getReadingLibrary("owner-a").books[11]).not.toHaveProperty(
      "completedAt",
    );
  });

  it("clamps pages and refuses invalid book identifiers or page counts", () => {
    saveReadingProgress("owner-a", "11", {
      pageIndex: 90,
      pageCount: 8,
      completed: false,
    });
    expect(getReadingLibrary("owner-a").books[11].pageIndex).toBe(7);
    saveReadingProgress("owner-a", 11, {
      pageIndex: -4,
      pageCount: 8,
      completed: false,
    });
    expect(getReadingLibrary("owner-a").books[11].pageIndex).toBe(0);
    expect(
      saveReadingProgress("owner-a", 11, {
        pageIndex: 1,
        pageCount: 0,
        completed: false,
      }),
    ).toBe(false);
    expect(
      saveReadingProgress("owner-a", 11, {
        pageIndex: 1,
        pageCount: 101,
        completed: false,
      }),
    ).toBe(false);
    expect(setBookFavorite(undefined, 11, true)).toBe(false);
    expect(setBookFavorite("owner-a", "__proto__", true)).toBe(false);
    expect(setBookFavorite("owner-a", "1e2", true)).toBe(false);
    expect(setBookFavorite("owner-a", 0, true)).toBe(false);
  });

  it("sanitizes malformed storage and drops unrecognized content", () => {
    const key = "hodam-reading-library:v1:owner-a";
    window.localStorage.setItem(key, "broken");
    expect(getReadingLibrary("owner-a")).toEqual({ books: {} });
    window.localStorage.setItem(
      key,
      JSON.stringify({
        books: {
          11: {
            favorite: true,
            childName: "not retained",
            pageIndex: 3,
            pageCount: 8,
            completedAt: "bad",
          },
          12: { pageIndex: 500, pageCount: 8, title: "not retained" },
          __bad: { favorite: true },
        },
      }),
    );
    expect(getReadingLibrary("owner-a")).toEqual({
      books: { 11: { favorite: true, pageIndex: 3, pageCount: 8 } },
    });
    setBookFavorite("owner-a", 13, true);
    expect(window.localStorage.getItem(key)).not.toContain("not retained");
  });

  it("notifies only the subscribing account in this tab and across tabs", () => {
    const callback = vi.fn();
    const stop = subscribeReadingLibrary("owner-a", callback);
    setBookFavorite("owner-b", 11, true);
    expect(callback).not.toHaveBeenCalled();
    setBookFavorite("owner-a", 11, true);
    expect(callback).toHaveBeenCalledTimes(1);
    window.dispatchEvent(
      new StorageEvent("storage", { key: "hodam-reading-library:v1:owner-b" }),
    );
    expect(callback).toHaveBeenCalledTimes(1);
    window.dispatchEvent(
      new StorageEvent("storage", { key: "hodam-reading-library:v1:owner-a" }),
    );
    expect(callback).toHaveBeenCalledTimes(2);
    window.dispatchEvent(new StorageEvent("storage", { key: null }));
    expect(callback).toHaveBeenCalledTimes(3);
    stop();
    setBookFavorite("owner-a", 11, false);
    expect(callback).toHaveBeenCalledTimes(3);
  });

  it("gracefully handles blocked or full browser storage without claiming success", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(getReadingLibrary("owner-a")).toEqual({ books: {} });
    expect(setBookFavorite("owner-a", 11, true)).toBe(false);
    expect(
      saveReadingProgress("owner-a", 11, {
        pageIndex: 2,
        pageCount: 8,
        completed: false,
      }),
    ).toBe(false);
  });

  it("bounds stored books and keeps the book just changed", () => {
    const books = Object.fromEntries(
      Array.from({ length: 1000 }, (_, index) => [
        index + 1,
        { favorite: true },
      ]),
    );
    window.localStorage.setItem(
      "hodam-reading-library:v1:owner-a",
      JSON.stringify({ books }),
    );
    setBookFavorite("owner-a", 1001, true);
    expect(Object.keys(getReadingLibrary("owner-a").books)).toHaveLength(1000);
    expect(getReadingLibrary("owner-a").books[1001]).toEqual({
      favorite: true,
    });
  });

  it("does not overwrite existing preferences when reading storage fails", () => {
    setBookFavorite("owner-a", 11, true);
    const write = vi.spyOn(Storage.prototype, "setItem");
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("read unavailable");
    });
    expect(setBookFavorite("owner-a", 12, true)).toBe(false);
    expect(write).not.toHaveBeenCalled();
  });
});
