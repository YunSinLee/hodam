import type { PersistStorage, StorageValue } from "zustand/middleware";

function getSafeLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function createSafePersistStorage<T>(): PersistStorage<T> {
  return {
    getItem: (name: string) => {
      const storage = getSafeLocalStorage();
      if (!storage) return null;

      let raw: string | null = null;
      try {
        raw = storage.getItem(name);
      } catch {
        return null;
      }

      if (!raw) return null;

      try {
        return JSON.parse(raw) as StorageValue<T>;
      } catch {
        // Corrupted payload can cause hydration/runtime crashes; drop it.
        try {
          storage.removeItem(name);
        } catch {
          // Ignore cleanup failure and continue with empty persisted state.
        }
        return null;
      }
    },
    setItem: (name: string, value: StorageValue<T>) => {
      const storage = getSafeLocalStorage();
      if (!storage) return;

      try {
        storage.setItem(name, JSON.stringify(value));
      } catch {
        // Ignore write failures (quota/private mode) and keep runtime stable.
      }
    },
    removeItem: (name: string) => {
      const storage = getSafeLocalStorage();
      if (!storage) return;

      try {
        storage.removeItem(name);
      } catch {
        // Ignore cleanup failures.
      }
    },
  };
}
