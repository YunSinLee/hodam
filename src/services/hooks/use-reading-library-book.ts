"use client";

import { useCallback } from "react";

import useReadingSync from "./use-reading-sync";

/** Keep each render scoped to its owner, including the render before effects run. */
export default function useReadingLibraryBook(
  ownerId?: string,
  bookId?: number,
) {
  const sync = useReadingSync(ownerId);
  const { saveProgress: saveBookProgress, setFavorite: favoriteBook } = sync;

  const saveProgress = useCallback(
    (pageIndex: number, pageCount: number, completed: boolean) => {
      if (!ownerId || !bookId) return true;
      return saveBookProgress(bookId, {
        pageIndex,
        pageCount,
        completed,
      });
    },
    [ownerId, bookId, saveBookProgress],
  );

  const favorite = useCallback(
    (value: boolean) => {
      if (!ownerId || !bookId) return false;
      return favoriteBook(bookId, value);
    },
    [ownerId, bookId, favoriteBook],
  );

  return {
    entry: ownerId && bookId ? sync.books[String(bookId)] : undefined,
    canSave: !!(ownerId && bookId),
    saveProgress,
    setFavorite: favorite,
    sync,
  };
}
