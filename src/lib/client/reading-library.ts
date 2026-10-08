export interface ReadingBookState {
  favorite?: true;
  pageIndex?: number;
  pageCount?: number;
  updatedAt?: number;
  completedAt?: number;
}

export interface ReadingLibraryState {
  books: Record<string, ReadingBookState>;
}

const storagePrefix = "hodam-reading-library:v1:";
const changeEvent = "hodam-reading-library-change";
const maxBooks = 1000;
const maxPages = 100;

function storageKey(ownerId: string | undefined) {
  return typeof ownerId === "string" && /^[a-zA-Z0-9_-]{1,256}$/.test(ownerId)
    ? `${storagePrefix}${ownerId}`
    : null;
}

function normalizedBookId(bookId: string | number) {
  if (typeof bookId === "string" && !/^[1-9]\d*$/.test(bookId)) return null;
  const value = typeof bookId === "number" ? bookId : Number(bookId);
  return Number.isSafeInteger(value) && value > 0 ? String(value) : null;
}

function timestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function normalizeState(value: unknown): ReadingLibraryState {
  const books: Record<string, ReadingBookState> = {};
  if (!value || typeof value !== "object") return { books };
  const raw = (value as { books?: unknown }).books;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { books };
  Object.entries(raw)
    .slice(0, maxBooks)
    .forEach(([id, entry]) => {
      if (!normalizedBookId(id) || !entry || typeof entry !== "object") return;
      const data = entry as ReadingBookState;
      const record: ReadingBookState = {};
      if (data.favorite === true) record.favorite = true;
      if (
        Number.isInteger(data.pageCount) &&
        data.pageCount! > 0 &&
        data.pageCount! <= maxPages &&
        Number.isInteger(data.pageIndex) &&
        data.pageIndex! >= 0 &&
        data.pageIndex! < data.pageCount!
      ) {
        record.pageIndex = data.pageIndex;
        record.pageCount = data.pageCount;
        if (timestamp(data.updatedAt)) record.updatedAt = data.updatedAt;
        if (timestamp(data.completedAt)) record.completedAt = data.completedAt;
      }
      if (Object.keys(record).length) books[id] = record;
    });
  return { books };
}

function readStoredState(key: string): ReadingLibraryState {
  // Let unavailable storage throw so a write cannot replace unreadable data.
  const stored = window.localStorage.getItem(key);
  if (!stored) return { books: {} };
  try {
    return normalizeState(JSON.parse(stored));
  } catch {
    return { books: {} };
  }
}

/** Only IDs and reading preferences are stored; book text and child names stay out. */
export function getReadingLibrary(
  ownerId: string | undefined,
): ReadingLibraryState {
  const key = storageKey(ownerId);
  if (!key || typeof window === "undefined") return { books: {} };
  try {
    return readStoredState(key);
  } catch {
    return { books: {} };
  }
}

function updateBook(
  ownerId: string | undefined,
  bookId: string | number,
  update: (previous: ReadingBookState) => ReadingBookState,
) {
  const key = storageKey(ownerId);
  const id = normalizedBookId(bookId);
  if (!key || !id || typeof window === "undefined") return false;
  try {
    const state = readStoredState(key);
    const next = update(state.books[id] || {});
    if (Object.keys(next).length) state.books[id] = next;
    else delete state.books[id];
    const entries = Object.entries(state.books);
    if (entries.length > maxBooks) {
      // Retain the just-changed book, then the most recently read books.
      entries.sort(([leftId, left], [rightId, right]) => {
        if (leftId === id) return -1;
        if (rightId === id) return 1;
        return (right.updatedAt || 0) - (left.updatedAt || 0);
      });
      state.books = Object.fromEntries(entries.slice(0, maxBooks));
    }
    window.localStorage.setItem(key, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent(changeEvent, { detail: { ownerId } }));
    return true;
  } catch {
    return false;
  }
}

export function saveReadingProgress(
  ownerId: string | undefined,
  bookId: string | number,
  progress: { pageIndex: number; pageCount: number; completed: boolean },
) {
  if (
    !Number.isInteger(progress.pageCount) ||
    progress.pageCount < 1 ||
    progress.pageCount > maxPages ||
    !Number.isFinite(progress.pageIndex) ||
    typeof progress.completed !== "boolean"
  )
    return false;
  return updateBook(ownerId, bookId, previous => {
    const now = Date.now();
    const rest = { ...previous };
    delete rest.completedAt;
    return {
      ...rest,
      pageIndex: Math.max(
        0,
        Math.min(Math.trunc(progress.pageIndex), progress.pageCount - 1),
      ),
      pageCount: progress.pageCount,
      updatedAt: now,
      ...(progress.completed ? { completedAt: now } : {}),
    };
  });
}

export function setBookFavorite(
  ownerId: string | undefined,
  bookId: string | number,
  favorite: boolean,
) {
  if (typeof favorite !== "boolean") return false;
  return updateBook(ownerId, bookId, previous => {
    const rest = { ...previous };
    delete rest.favorite;
    return favorite ? { ...rest, favorite: true } : rest;
  });
}

/** Synchronizes one account across components and tabs without exposing other accounts. */
export function subscribeReadingLibrary(
  ownerId: string | undefined,
  onChange: () => void,
) {
  const key = storageKey(ownerId);
  if (!key || typeof window === "undefined") return () => {};
  const handleLocal = (event: Event) => {
    if (
      (event as CustomEvent<{ ownerId?: string }>).detail?.ownerId === ownerId
    )
      onChange();
  };
  const handleStorage = (event: StorageEvent) => {
    if (event.key === key || event.key === null) onChange();
  };
  window.addEventListener(changeEvent, handleLocal);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(changeEvent, handleLocal);
    window.removeEventListener("storage", handleStorage);
  };
}
