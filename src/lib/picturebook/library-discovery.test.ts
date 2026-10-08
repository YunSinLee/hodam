import { describe, expect, it } from "vitest";

import type { ReadingBookState } from "@/lib/client/reading-library";

import {
  compareLibraryEntries,
  getBookReadingStatus,
  getChildShelfKey,
} from "./library-discovery";
import { createSampleBook } from "./sample";

import type { LibraryEntry, LibrarySort } from "./library-discovery";

const completeBook = createSampleBook("민준", "A");
const draftBook = createSampleBook("민준");
const readTime = Date.parse("2026-10-08T00:00:00Z");
const progress: ReadingBookState = {
  pageIndex: 2,
  pageCount: 8,
  updatedAt: readTime,
};

function entry(id: number, date: string, title = `그림책 ${id}`): LibraryEntry {
  return { thread: { id, created_at: date }, title, book: completeBook };
}
function sorted(
  entries: LibraryEntry[],
  sort: LibrarySort,
  readingBooks: Record<string, ReadingBookState> = {},
) {
  return [...entries]
    .sort((left, right) =>
      compareLibraryEntries(sort, left, right, readingBooks),
    )
    .map(item => item.thread.id);
}

describe("child shelf keys", () => {
  it("groups trimmed and canonically equivalent names without merging different names", () => {
    expect(getChildShelfKey("  민준  ")).toBe("민준");
    expect(getChildShelfKey("민준".normalize("NFD"))).toBe("민준");
    expect(getChildShelfKey("민 준")).toBe("민 준");
    expect(getChildShelfKey("MIN")).not.toBe(getChildShelfKey("min"));
    expect(getChildShelfKey("   ")).toBe("");
  });
});

describe("book reading status", () => {
  it("keeps favorite-only books unread and recognizes a saved first page as reading", () => {
    expect(getBookReadingStatus(completeBook)).toBe("unread");
    expect(getBookReadingStatus(completeBook, { favorite: true })).toBe(
      "unread",
    );
    expect(
      getBookReadingStatus(completeBook, { ...progress, pageIndex: 0 }),
    ).toBe("reading");
    expect(getBookReadingStatus(completeBook, progress)).toBe("reading");
  });

  it("requires a complete current-length book and a valid completion timestamp to mark finished", () => {
    expect(
      getBookReadingStatus(completeBook, {
        ...progress,
        pageIndex: 6,
        completedAt: readTime,
      }),
    ).toBe("finished");
    expect(
      getBookReadingStatus(draftBook, {
        ...progress,
        pageIndex: 3,
        pageCount: 4,
        completedAt: readTime,
      }),
    ).toBe("reading");
    expect(
      getBookReadingStatus(completeBook, {
        ...progress,
        pageIndex: 3,
        pageCount: 4,
        completedAt: readTime,
      }),
    ).toBe("reading");
    expect(
      getBookReadingStatus(completeBook, { ...progress, pageIndex: 7 }),
    ).toBe("reading");
  });

  it("does not call an early-page legacy bookmark finished just because it retains completedAt", () => {
    expect(
      getBookReadingStatus(completeBook, {
        ...progress,
        pageIndex: 0,
        completedAt: readTime,
      }),
    ).toBe("reading");
    expect(
      getBookReadingStatus(completeBook, {
        ...progress,
        pageIndex: 5,
        completedAt: readTime,
      }),
    ).toBe("reading");
    expect(
      getBookReadingStatus(completeBook, {
        ...progress,
        pageIndex: 6,
        completedAt: readTime,
      }),
    ).toBe("finished");
    expect(
      getBookReadingStatus(completeBook, {
        ...progress,
        pageIndex: 7,
        completedAt: readTime,
      }),
    ).toBe("finished");
  });

  it.each([
    { pageIndex: -1 },
    { pageIndex: 8 },
    { pageIndex: 1.5 },
    { pageIndex: Number.NaN },
    { pageCount: 0 },
    { pageCount: 9 },
    { pageCount: 2 },
    { pageCount: 4.5 },
    { pageCount: Number.POSITIVE_INFINITY },
    { updatedAt: undefined },
    { updatedAt: 0 },
    { updatedAt: -1 },
    { updatedAt: Number.NaN },
    { updatedAt: Number.POSITIVE_INFINITY },
    { updatedAt: 9_000_000_000_000_000 },
    { completedAt: 0 },
    { completedAt: -1 },
    { completedAt: Number.NaN },
    { completedAt: Number.POSITIVE_INFINITY },
  ])("does not treat invalid bookmark metadata as a read: %j", invalid => {
    expect(
      getBookReadingStatus(completeBook, { ...progress, ...invalid }),
    ).toBe("unread");
  });
});

describe("library entry sorting", () => {
  const older = entry(40, "2026-09-01T00:00:00Z");
  const newer = entry(10, "2026-10-01T00:00:00Z");
  const sameDate = entry(20, "2026-10-01T00:00:00Z");
  const invalid = entry(70, "not a date");
  const invalidAgain = entry(80, "");

  it("sorts valid creation dates and leaves invalid dates last with deterministic ID ties", () => {
    const entries = [invalid, newer, older, invalidAgain, sameDate];
    expect(sorted(entries, "newest")).toEqual([20, 10, 40, 80, 70]);
    expect(sorted(entries, "oldest")).toEqual([40, 20, 10, 80, 70]);
    expect(sorted([...entries].reverse(), "newest")).toEqual([
      20, 10, 40, 80, 70,
    ]);
  });

  it("puts recently read books first and uses newest-first for books without a valid reading record", () => {
    const readingBooks = {
      40: { ...progress, updatedAt: readTime - 1 },
      70: { ...progress, updatedAt: readTime },
      10: { favorite: true as const },
      20: { ...progress, pageIndex: 99, updatedAt: readTime + 1 },
    };
    expect(
      sorted(
        [older, newer, sameDate, invalid, invalidAgain],
        "recently-read",
        readingBooks,
      ),
    ).toEqual([70, 40, 20, 10, 80]);
  });

  it("uses IDs for equal reading timestamps and does not infer reading from archived books", () => {
    const archived: LibraryEntry = { ...invalidAgain, book: null };
    expect(
      sorted([newer, sameDate, archived], "recently-read", {
        10: progress,
        20: progress,
        80: { ...progress, updatedAt: readTime + 10 },
      }),
    ).toEqual([20, 10, 80]);
  });

  it("sorts Korean titles with numeric ordering and stable ties for normalized names", () => {
    expect(
      sorted(
        [
          entry(1, "", "그림책 10"),
          entry(2, "", "그림책 2"),
          entry(3, "", "  가방  "),
          entry(4, "", "가방".normalize("NFD")),
        ],
        "title",
      ),
    ).toEqual([4, 3, 2, 1]);
  });

  it("compares without changing source entries or reading metadata", () => {
    const entries = [older, newer];
    const readingBooks = { 40: { ...progress } };
    const before = JSON.stringify({ entries, readingBooks });
    sorted(entries, "recently-read", readingBooks);
    expect(JSON.stringify({ entries, readingBooks })).toBe(before);
    expect(
      compareLibraryEntries("recently-read", older, older, readingBooks),
    ).toBe(0);
  });
});
