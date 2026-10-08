// A deterministic store for reader/library component tests. Transport, durable
// queues and conflicts are exercised by reading-sync.test.ts, not this adapter.
import { useCallback, useEffect, useState } from "react";

import {
  getReadingLibrary,
  saveReadingProgress,
  setBookFavorite,
  subscribeReadingLibrary,
} from "../../src/lib/client/reading-library";
import type { ReadingProgress } from "../../src/lib/picturebook/reading-state";

export default function useReadingSyncUiMock(ownerId?: string) {
  const [, redraw] = useState(0);
  useEffect(
    () => subscribeReadingLibrary(ownerId, () => redraw(value => value + 1)),
    [ownerId],
  );
  const setFavorite = useCallback(
    (bookId: number, favorite: boolean) =>
      setBookFavorite(ownerId, bookId, favorite),
    [ownerId],
  );
  const saveProgress = useCallback(
    (bookId: number, progress: ReadingProgress) =>
      saveReadingProgress(ownerId, bookId, progress),
    [ownerId],
  );
  return {
    books: getReadingLibrary(ownerId).books,
    status: "synced" as const,
    pendingCount: 0,
    legacyCount: 0,
    localOnlyCount: 0,
    storageAvailable: true,
    setFavorite,
    saveProgress,
    retry: () => {},
    importLegacy: () => {},
    dismissLegacy: () => {},
  };
}
