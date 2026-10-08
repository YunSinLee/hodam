"use client";

import { useCallback, useEffect, useState } from "react";

import {
  getReadingLibrary,
  saveReadingProgress,
  setBookFavorite,
  subscribeReadingLibrary,
} from "@/lib/client/reading-library";

type BookState = ReturnType<typeof getReadingLibrary>["books"][string];

/** Keep each render scoped to its owner, including the render before effects run. */
export default function useReadingLibraryBook(
  ownerId?: string,
  bookId?: number,
) {
  const identity = ownerId && bookId ? `${ownerId}:${bookId}` : "";
  const [snapshot, setSnapshot] = useState<{
    identity: string;
    entry?: BookState;
  }>({ identity: "" });

  useEffect(() => {
    if (!ownerId || !bookId) {
      setSnapshot({ identity: "" });
      return undefined;
    }
    const refresh = () =>
      setSnapshot({
        identity,
        entry: getReadingLibrary(ownerId).books[String(bookId)],
      });
    refresh();
    return subscribeReadingLibrary(ownerId, refresh);
  }, [ownerId, bookId, identity]);

  const saveProgress = useCallback(
    (pageIndex: number, pageCount: number, completed: boolean) => {
      if (!ownerId || !bookId) return true;
      return saveReadingProgress(ownerId, bookId, {
        pageIndex,
        pageCount,
        completed,
      });
    },
    [ownerId, bookId],
  );

  const favorite = useCallback(
    (value: boolean) => {
      if (!ownerId || !bookId) return false;
      return setBookFavorite(ownerId, bookId, value);
    },
    [ownerId, bookId],
  );

  return {
    entry: snapshot.identity === identity ? snapshot.entry : undefined,
    canSave: !!identity,
    saveProgress,
    setFavorite: favorite,
  };
}
