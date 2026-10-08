import { z } from "zod";

import {
  ReadingProgressSchema,
  ReadingStateBookSchema,
  ReadingStateInputSchema,
} from "@/lib/picturebook/reading-state";
import type {
  ReadingProgress,
  ReadingStateBook,
  ReadingStateInput,
} from "@/lib/picturebook/reading-state";

import readingStateApi from "./api/reading-state";
import { getReadingLibrary } from "./reading-library";

import type { ReadingBookState } from "./reading-library";

export type ReadingSyncStatus =
  | "loading"
  | "syncing"
  | "synced"
  | "offline"
  | "error"
  | "conflict";
export interface ReadingSyncSnapshot {
  books: Record<string, ReadingBookState>;
  status: ReadingSyncStatus;
  pendingCount: number;
  legacyCount: number;
  localOnlyCount: number;
  storageAvailable: boolean;
}

const PendingSchema = z.object({
  id: z.string().min(1).max(100),
  createdBy: z.string().min(1).max(100),
  bookId: z.number().int().positive().safe(),
  input: ReadingStateInputSchema,
  updatedAt: z.number().int().positive(),
  imported: z.boolean(),
});
type Pending = z.infer<typeof PendingSchema>;
type Field = ReadingStateInput["field"];
const cacheSchema = z.array(ReadingStateBookSchema).max(10000);
const prefix = "hodam-reading-sync:v2:";
const maxPending = 2000;

export const emptyReadingSyncSnapshot: ReadingSyncSnapshot = {
  books: {},
  status: "synced",
  pendingCount: 0,
  legacyCount: 0,
  localOnlyCount: 0,
  storageAvailable: true,
};

function version(book: ReadingStateBook | undefined, field: Field) {
  return (
    book?.[field === "favorite" ? "favoriteVersion" : "progressVersion"] || 0
  );
}
function keyFor(bookId: number, field: Field) {
  return `${bookId}:${field}`;
}
function validId(bookId: number) {
  return Number.isSafeInteger(bookId) && bookId > 0;
}
function operationId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}
function online() {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}
function mergeBook(
  current: ReadingStateBook | undefined,
  incoming: ReadingStateBook,
): ReadingStateBook {
  if (!current) return incoming;
  return {
    threadId: incoming.threadId,
    ...(incoming.favoriteVersion >= current.favoriteVersion
      ? {
          favorite: incoming.favorite,
          favoriteVersion: incoming.favoriteVersion,
        }
      : {
          favorite: current.favorite,
          favoriteVersion: current.favoriteVersion,
        }),
    ...(incoming.progressVersion >= current.progressVersion
      ? {
          progress: incoming.progress,
          progressVersion: incoming.progressVersion,
        }
      : {
          progress: current.progress,
          progressVersion: current.progressVersion,
        }),
  };
}
function toClient(book: ReadingStateBook): ReadingBookState {
  const timestamp = book.progress
    ? Date.parse(book.progress.updatedAt)
    : undefined;
  return {
    ...(book.favorite ? { favorite: true as const } : {}),
    ...(book.progress
      ? {
          pageIndex: book.progress.pageIndex,
          pageCount: book.progress.pageCount,
          updatedAt: timestamp,
          ...(book.progress.completed ? { completedAt: timestamp } : {}),
        }
      : {}),
  };
}
function matchesIntent(book: ReadingStateBook, input: ReadingStateInput) {
  if (input.field === "favorite") return book.favorite === input.favorite;
  return (
    book.progress?.pageIndex === input.progress.pageIndex &&
    book.progress?.completed === input.progress.completed &&
    book.progress.pageCount >= input.progress.pageCount
  );
}

/** A shared account-scoped store. Network replies never select or change its owner. */
export class ReadingSyncEngine {
  private readonly clientId = operationId();

  private readonly cacheKey: string;

  private readonly pendingPrefix: string;

  private listeners = new Set<() => void>();

  private remote: Record<string, ReadingStateBook> = {};

  private pending = new Map<string, Pending>();

  private volatile = new Set<string>();

  private legacy: Record<string, ReadingBookState> = {};

  private ignoredLegacy = new Set<string>();

  private legacyDismissed = false;

  private importRequested = false;

  private snapshot: ReadingSyncSnapshot = {
    ...emptyReadingSyncSnapshot,
    status: "loading",
  };

  private active = false;

  private epoch = 0;

  private ready = false;

  private hasCachedBaseline = false;

  // Never persisted: only this first in-flight read can establish these bases.
  private unknownBaseline = new Map<string, string>();

  private refreshing = false;

  private flushing = false;

  private flushScheduled = false;

  private problem: "error" | "conflict" | null = null;

  private blocked = false;

  private storageAvailable = true;

  private controllers = new Set<AbortController>();

  private writeRevision = 0;

  private writtenAt = new Map<number, number>();

  constructor(readonly ownerId: string) {
    this.cacheKey = `${prefix}${ownerId}:cache`;
    this.pendingPrefix = `${prefix}${ownerId}:pending:`;
  }

  getSnapshot = () => this.snapshot;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    if (!this.active) this.start();
    return () => {
      this.listeners.delete(listener);
      if (!this.listeners.size) this.stop();
    };
  };

  private start() {
    if (typeof window === "undefined") return;
    this.active = true;
    this.epoch += 1;
    this.problem = null;
    this.blocked = false;
    this.loadStorage();
    this.legacy = getReadingLibrary(this.ownerId).books;
    window.addEventListener("online", this.onReconnect);
    window.addEventListener("offline", this.onOffline);
    window.addEventListener("focus", this.onReconnect);
    window.addEventListener("storage", this.onStorage);
    this.emit();
    this.refresh();
  }

  private stop() {
    this.active = false;
    this.epoch += 1;
    this.unknownBaseline.clear();
    this.controllers.forEach(controller => controller.abort());
    this.controllers.clear();
    this.refreshing = false;
    this.flushing = false;
    this.flushScheduled = false;
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.onReconnect);
      window.removeEventListener("offline", this.onOffline);
      window.removeEventListener("focus", this.onReconnect);
      window.removeEventListener("storage", this.onStorage);
    }
  }

  private isCurrent(epoch: number) {
    return this.active && epoch === this.epoch;
  }

  private onOffline = () => {
    this.emit();
  };

  private onReconnect = () => {
    if (online()) {
      this.problem = null;
      this.refresh();
    }
  };

  private onStorage = (event: StorageEvent) => {
    if (
      event.key === null ||
      event.key === this.cacheKey ||
      event.key?.startsWith(this.pendingPrefix)
    ) {
      this.loadStorage();
      this.emit();
      this.scheduleFlush();
    }
  };

  private loadStorage() {
    try {
      const stored = window.localStorage.getItem(this.cacheKey);
      if (stored) {
        try {
          const parsed = cacheSchema.safeParse(JSON.parse(stored));
          if (parsed.success) {
            this.hasCachedBaseline = true;
            parsed.data.forEach(book => {
              const current = this.remote[book.threadId];
              if (
                !current ||
                book.favoriteVersion > current.favoriteVersion ||
                book.progressVersion > current.progressVersion
              ) {
                this.writeRevision += 1;
                this.writtenAt.set(book.threadId, this.writeRevision);
              }
              this.remote[book.threadId] = mergeBook(current, book);
            });
          }
        } catch {
          /* A damaged cache must not hide valid pending writes. */
        }
      }
      const disk = new Map<string, Pending>();
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        // eslint-disable-next-line no-continue
        if (!key?.startsWith(this.pendingPrefix)) continue;
        const raw = window.localStorage.getItem(key);
        // eslint-disable-next-line no-continue
        if (!raw) continue;
        try {
          const parsed = PendingSchema.safeParse(JSON.parse(raw));
          if (
            parsed.success &&
            key ===
              this.pendingPrefix +
                keyFor(parsed.data.bookId, parsed.data.input.field) &&
            disk.size < maxPending
          )
            disk.set(
              keyFor(parsed.data.bookId, parsed.data.input.field),
              parsed.data,
            );
        } catch {
          /* Ignore malformed local records, never upload them. */
        }
      }
      this.pending.forEach((op, key) => {
        if (this.volatile.has(key)) disk.set(key, op);
      });
      this.pending = disk;
    } catch {
      this.storageAvailable = false;
    }
  }

  private persistCache() {
    try {
      window.localStorage.setItem(
        this.cacheKey,
        JSON.stringify(Object.values(this.remote).slice(0, 10000)),
      );
    } catch {
      this.storageAvailable = false;
    }
  }

  private persistPending(key: string, op: Pending) {
    try {
      window.localStorage.setItem(this.pendingPrefix + key, JSON.stringify(op));
      this.volatile.delete(key);
    } catch {
      this.storageAvailable = false;
      this.volatile.add(key);
    }
  }

  private removePending(key: string, id: string) {
    if (this.pending.get(key)?.id === id) this.pending.delete(key);
    this.volatile.delete(key);
    try {
      const raw = window.localStorage.getItem(this.pendingPrefix + key);
      if (raw && PendingSchema.safeParse(JSON.parse(raw)).data?.id === id)
        window.localStorage.removeItem(this.pendingPrefix + key);
    } catch {
      this.storageAvailable = false;
    }
  }

  private legacyFields() {
    const entries: { bookId: number; field: Field; value: ReadingBookState }[] =
      [];
    Object.entries(this.legacy).forEach(([id, value]) => {
      const bookId = Number(id);
      if (!validId(bookId)) return;
      if (
        value.favorite &&
        !version(this.remote[id], "favorite") &&
        !this.ignoredLegacy.has(keyFor(bookId, "favorite"))
      )
        entries.push({ bookId, field: "favorite", value });
      if (
        value.pageIndex !== undefined &&
        value.pageCount !== undefined &&
        !version(this.remote[id], "progress") &&
        !this.ignoredLegacy.has(keyFor(bookId, "progress"))
      )
        entries.push({ bookId, field: "progress", value });
    });
    return entries;
  }

  private emit() {
    const books = Object.fromEntries(
      Object.entries(this.remote).map(([id, book]) => [id, toClient(book)]),
    );
    const legacy = this.legacyFields();
    legacy.forEach(({ bookId, field, value }) => {
      books[bookId] ||= {};
      if (field === "favorite") books[bookId].favorite = true;
      else
        Object.assign(books[bookId], {
          pageIndex: value.pageIndex,
          pageCount: value.pageCount,
          updatedAt: value.updatedAt,
          completedAt: value.completedAt,
        });
    });
    this.pending.forEach(op => {
      const entry = { ...(books[op.bookId] || {}) };
      if (op.input.field === "favorite") {
        if (op.input.favorite) entry.favorite = true;
        else delete entry.favorite;
      } else {
        entry.pageIndex = op.input.progress.pageIndex;
        entry.pageCount = op.input.progress.pageCount;
        entry.updatedAt = op.updatedAt;
        if (op.input.progress.completed) entry.completedAt = op.updatedAt;
        else delete entry.completedAt;
      }
      books[op.bookId] = entry;
    });
    const localOnlyCount = new Set(legacy.map(entry => entry.bookId)).size;
    let status: ReadingSyncStatus = "synced";
    if (!online()) status = "offline";
    else if (this.problem) status = this.problem;
    else if (!this.ready) status = "loading";
    else if (this.refreshing || this.flushing || this.pending.size)
      status = "syncing";
    this.snapshot = {
      books,
      status,
      pendingCount: this.pending.size,
      storageAvailable: this.storageAvailable,
      legacyCount:
        this.legacyDismissed || this.importRequested ? 0 : localOnlyCount,
      localOnlyCount,
    };
    this.listeners.forEach(listener => listener());
  }

  private async refresh() {
    if (!this.active || this.refreshing || !online()) {
      this.emit();
      return;
    }
    const { epoch } = this;
    const startedAt = this.writeRevision;
    const controller = new AbortController();
    this.controllers.add(controller);
    this.refreshing = true;
    this.emit();
    try {
      const incoming: Record<string, ReadingStateBook> = {};
      let pageCount = 0;
      const fetchPage = async (after?: number): Promise<void> => {
        pageCount += 1;
        if (pageCount > 100) throw new Error("Too many reading library pages");
        const page = await readingStateApi.list(
          this.ownerId,
          after,
          controller.signal,
        );
        if (!this.isCurrent(epoch)) return;
        page.books.forEach(book => {
          incoming[book.threadId] = book;
        });
        if (Object.keys(incoming).length > 10000)
          throw new Error("Reading library limit exceeded");
        if (page.nextCursor !== null) {
          if (page.nextCursor <= (after || 0))
            throw new Error("Invalid reading library cursor");
          await fetchPage(page.nextCursor);
        }
      };
      await fetchPage();
      if (!this.isCurrent(epoch)) return;
      // A first-read baseline must come from that GET, not a later other-tab write.
      const initialVersions = new Map<string, number>();
      this.unknownBaseline.forEach((opId, key) => {
        const op = this.pending.get(key);
        if (op?.id === opId)
          initialVersions.set(
            key,
            version(incoming[op.bookId], op.input.field),
          );
      });
      // Other tabs may have written before their storage event reaches this tab.
      this.loadStorage();
      Object.entries(incoming).forEach(([id, book]) => {
        incoming[id] = mergeBook(this.remote[id], book);
      });
      this.writtenAt.forEach((revision, bookId) => {
        if (revision > startedAt && this.remote[bookId])
          incoming[bookId] = mergeBook(incoming[bookId], this.remote[bookId]);
      });
      this.remote = incoming;
      this.ready = true;
      this.blocked = false;
      this.unknownBaseline.forEach((opId, key) => {
        const op = this.pending.get(key);
        if (op?.id !== opId) return;
        const based = {
          ...op,
          input: {
            ...op.input,
            expectedVersion: initialVersions.get(key) || 0,
          },
        };
        this.pending.set(key, based);
        this.persistPending(key, based);
      });
      this.unknownBaseline.clear();
      this.persistCache();
      if (this.importRequested) this.enqueueLegacy();
    } catch {
      if (this.isCurrent(epoch)) {
        this.unknownBaseline.clear();
        this.problem = "error";
        this.blocked = true;
      }
    } finally {
      this.controllers.delete(controller);
      if (this.isCurrent(epoch)) {
        this.refreshing = false;
        this.emit();
        this.scheduleFlush();
      }
    }
  }

  private queue(bookId: number, input: ReadingStateInput, imported = false) {
    if (
      !this.active ||
      !validId(bookId) ||
      !ReadingStateInputSchema.safeParse(input).success
    )
      return false;
    const key = keyFor(bookId, input.field);
    const previous = this.pending.get(key);
    const awaitInitialBaseline =
      !this.ready &&
      this.refreshing &&
      !this.hasCachedBaseline &&
      !this.remote[bookId] &&
      (!previous || this.unknownBaseline.get(key) === previous.id);
    if (!this.pending.has(key) && this.pending.size >= maxPending) {
      this.problem = "error";
      this.emit();
      return false;
    }
    const op: Pending = {
      id: operationId(),
      createdBy: this.clientId,
      bookId,
      input,
      updatedAt: Date.now(),
      imported,
    };
    this.pending.set(key, op);
    if (awaitInitialBaseline) this.unknownBaseline.set(key, op.id);
    this.persistPending(key, op);
    this.problem = null;
    this.blocked = false;
    this.emit();
    this.scheduleFlush();
    return true;
  }

  setFavorite = (bookId: number, favorite: boolean) =>
    this.queue(bookId, {
      field: "favorite",
      favorite,
      expectedVersion:
        this.pending.get(keyFor(bookId, "favorite"))?.input.expectedVersion ??
        version(this.remote[bookId], "favorite"),
    });

  saveProgress = (bookId: number, progress: ReadingProgress) => {
    if (!ReadingProgressSchema.safeParse(progress).success) return false;
    return this.queue(bookId, {
      field: "progress",
      progress,
      expectedVersion:
        this.pending.get(keyFor(bookId, "progress"))?.input.expectedVersion ??
        version(this.remote[bookId], "progress"),
    });
  };

  private scheduleFlush() {
    if (
      !this.active ||
      !this.ready ||
      this.refreshing ||
      this.flushing ||
      this.flushScheduled ||
      this.blocked ||
      !online() ||
      !this.pending.size
    )
      return;
    this.flushScheduled = true;
    queueMicrotask(() => {
      this.flushScheduled = false;
      if (this.active) this.flush();
    });
  }

  private async flush() {
    if (
      this.flushing ||
      !this.ready ||
      this.refreshing ||
      this.blocked ||
      !online()
    )
      return;
    const first = this.pending.entries().next().value as
      | [string, Pending]
      | undefined;
    if (!first) return;
    const [key, op] = first;
    const { epoch } = this;
    const controller = new AbortController();
    this.controllers.add(controller);
    this.flushing = true;
    this.emit();
    try {
      const result = await readingStateApi.save(
        this.ownerId,
        op.bookId,
        op.input,
        controller.signal,
      );
      if (!this.isCurrent(epoch)) return;
      if (result.book.threadId !== op.bookId)
        throw new Error("Wrong reading state book");
      this.loadStorage();
      this.remote[op.bookId] = mergeBook(this.remote[op.bookId], result.book);
      this.writeRevision += 1;
      this.writtenAt.set(op.bookId, this.writeRevision);
      this.persistCache();
      const latest = this.pending.get(key);
      const accepted = result.applied || matchesIntent(result.book, op.input);
      if (accepted) {
        if (latest?.id === op.id) this.removePending(key, op.id);
        else if (
          latest &&
          latest.createdBy === this.clientId &&
          latest.input.expectedVersion === op.input.expectedVersion
        ) {
          const rebased = {
            ...latest,
            input: {
              ...latest.input,
              expectedVersion: version(result.book, op.input.field),
            },
          };
          this.pending.set(key, rebased);
          this.persistPending(key, rebased);
        }
      } else {
        if (latest && latest.input.expectedVersion === op.input.expectedVersion)
          this.removePending(key, latest.id);
        this.problem = "conflict";
      }
    } catch (error) {
      if (!this.isCurrent(epoch)) return;
      const status =
        error && typeof error === "object" && "status" in error
          ? Number(error.status)
          : 0;
      const code =
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : "";
      const bookChanged =
        status === 409 &&
        ["READING_BOOK_CHANGED", "BOOK_CHANGED"].includes(code);
      const invalidBook =
        status === 404 || (status === 409 && code === "READING_BOOK_INVALID");
      const versionExhausted =
        status === 409 && code === "READING_STATE_VERSION_EXHAUSTED";
      if (
        [400, 404, 422].includes(status) ||
        bookChanged ||
        invalidBook ||
        versionExhausted
      ) {
        // Invalid/deleted books cannot be retried forever. A fresh user edit may try again.
        const latest = this.pending.get(key);
        if (latest?.id === op.id) this.removePending(key, op.id);
        if (versionExhausted) this.ignoredLegacy.add(key);
        if (invalidBook) {
          this.ignoredLegacy.add(keyFor(op.bookId, "favorite"));
          this.ignoredLegacy.add(keyFor(op.bookId, "progress"));
          delete this.remote[op.bookId];
          ["favorite", "progress"].forEach(field => {
            const otherKey = keyFor(op.bookId, field as Field);
            const other = this.pending.get(otherKey);
            if (other) this.removePending(otherKey, other.id);
          });
          this.persistCache();
        }
        this.blocked = false;
      } else this.blocked = true;
      this.problem = bookChanged ? "conflict" : "error";
    } finally {
      this.controllers.delete(controller);
      if (this.isCurrent(epoch)) {
        this.flushing = false;
        this.emit();
        this.scheduleFlush();
      }
    }
  }

  retry = () => {
    this.problem = null;
    this.blocked = false;
    this.storageAvailable = true;
    this.loadStorage();
    this.pending.forEach((op, key) => this.persistPending(key, op));
    this.refresh();
  };

  importLegacy = () => {
    this.importRequested = true;
    this.legacyDismissed = false;
    this.problem = null;
    if (this.ready && !this.refreshing) this.enqueueLegacy();
    else this.refresh();
    this.emit();
  };

  private enqueueLegacy() {
    this.importRequested = false;
    this.legacyDismissed = true;
    this.legacyFields().forEach(({ bookId, field, value }) => {
      if (this.pending.has(keyFor(bookId, field))) return;
      if (field === "favorite")
        this.queue(bookId, { field, favorite: true, expectedVersion: 0 }, true);
      else
        this.queue(
          bookId,
          {
            field,
            expectedVersion: 0,
            progress: {
              pageIndex: value.pageIndex!,
              pageCount: value.pageCount!,
              completed: !!value.completedAt,
            },
          },
          true,
        );
    });
  }

  dismissLegacy = () => {
    this.legacyDismissed = true;
    this.emit();
  };
}

const engines = new Map<string, ReadingSyncEngine>();
export function getReadingSyncEngine(ownerId: string) {
  if (!/^[a-zA-Z0-9_-]{1,256}$/.test(ownerId)) return undefined;
  if (typeof window === "undefined") return new ReadingSyncEngine(ownerId);
  let engine = engines.get(ownerId);
  if (!engine) {
    engine = new ReadingSyncEngine(ownerId);
    engines.set(ownerId, engine);
  }
  return engine;
}
