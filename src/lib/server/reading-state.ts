import { ReadingStateBookSchema } from "@/lib/picturebook/reading-state";

export const readingStateColumns =
  "thread_id, favorite, favorite_version, page_index, page_count, completed, progress_updated_at, progress_version";

export function toReadingStateBook(row: unknown) {
  if (!row || typeof row !== "object") {
    throw new Error("READING_STATE_INVALID_ROW");
  }
  const record = row as Record<string, unknown>;
  return ReadingStateBookSchema.parse({
    threadId: record.thread_id,
    favorite: record.favorite,
    favoriteVersion: record.favorite_version,
    progress:
      record.page_index === null
        ? null
        : {
            pageIndex: record.page_index,
            pageCount: record.page_count,
            completed: record.completed,
            updatedAt: record.progress_updated_at,
          },
    progressVersion: record.progress_version,
  });
}
