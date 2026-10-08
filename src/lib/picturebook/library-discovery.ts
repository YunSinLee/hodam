import type { PicturebookDraft } from "@/app/types/openai";
import type { ReadingBookState } from "@/lib/client/reading-library";

export type LibrarySort = "newest" | "oldest" | "recently-read" | "title";
export type BookReadingStatus = "unread" | "reading" | "finished";

export interface LibraryEntry {
  thread: { id: number; created_at: string };
  title: string;
  book: Pick<PicturebookDraft, "status" | "pages"> | null;
}

const titleCollator = new Intl.Collator("ko", {
  numeric: true,
  sensitivity: "base",
});

export function getChildShelfKey(name: string) {
  return name.trim().normalize("NFC");
}

function validTimestamp(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    Number.isFinite(new Date(value).getTime())
  );
}

export function getBookReadingStatus(
  book: Pick<PicturebookDraft, "status" | "pages">,
  progress?: ReadingBookState,
): BookReadingStatus {
  if (!progress) return "unread";
  const { pageIndex, pageCount, updatedAt, completedAt } = progress;
  if (
    !Number.isInteger(pageIndex) ||
    !Number.isInteger(pageCount) ||
    pageCount! < 1 ||
    pageCount! > 100 ||
    pageCount! > book.pages.length ||
    pageIndex! < 0 ||
    pageIndex! >= pageCount! ||
    !validTimestamp(updatedAt) ||
    (completedAt !== undefined && !validTimestamp(completedAt))
  )
    return "unread";
  // A four-page bookmark remains useful after the ending adds four more pages.
  if (
    book.status === "complete" &&
    pageCount === book.pages.length &&
    pageIndex! >= Math.max(0, pageCount - 2) &&
    completedAt !== undefined
  )
    return "finished";
  return "reading";
}

function createdAt(entry: LibraryEntry) {
  const value = Date.parse(entry.thread.created_at);
  return Number.isFinite(value) ? value : null;
}

function compareDates(
  left: number | null,
  right: number | null,
  oldest = false,
) {
  if (left === null) return right === null ? 0 : 1;
  if (right === null) return -1;
  return oldest ? left - right : right - left;
}

function readAt(
  entry: LibraryEntry,
  readingBooks: Record<string, ReadingBookState>,
) {
  const progress = readingBooks[entry.thread.id];
  return entry.book && getBookReadingStatus(entry.book, progress) !== "unread"
    ? progress.updatedAt!
    : null;
}

export function compareLibraryEntries(
  sort: LibrarySort,
  left: LibraryEntry,
  right: LibraryEntry,
  readingBooks: Record<string, ReadingBookState>,
) {
  let comparison = 0;
  if (sort === "title") {
    comparison = titleCollator.compare(
      left.title.trim().normalize("NFC"),
      right.title.trim().normalize("NFC"),
    );
  } else if (sort === "recently-read") {
    const leftReadAt = readAt(left, readingBooks);
    const rightReadAt = readAt(right, readingBooks);
    comparison = compareDates(leftReadAt, rightReadAt);
    if (leftReadAt === null && rightReadAt === null)
      comparison = compareDates(createdAt(left), createdAt(right));
  } else {
    comparison = compareDates(
      createdAt(left),
      createdAt(right),
      sort === "oldest",
    );
  }
  return comparison || right.thread.id - left.thread.id;
}
