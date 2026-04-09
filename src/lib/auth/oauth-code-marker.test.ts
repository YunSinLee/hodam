import { afterEach, describe, expect, it, vi } from "vitest";

import {
  cleanupExpiredOAuthCodeMarkers,
  clearOAuthCodeMarker,
  hasRecentOAuthCodeMarker,
  markOAuthCodeInFlight,
} from "@/lib/auth/oauth-code-marker";

class StorageMock implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

const ORIGINAL_WINDOW = (globalThis as { window?: unknown }).window;

function attachWindowStorage(storage: Storage) {
  Object.defineProperty(globalThis, "window", {
    value: { sessionStorage: storage },
    configurable: true,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(globalThis, "window", {
    value: ORIGINAL_WINDOW,
    configurable: true,
  });
});

describe("oauth code marker", () => {
  it("marks and clears marker", () => {
    const storage = new StorageMock();
    attachWindowStorage(storage);
    vi.spyOn(Date, "now").mockReturnValue(1000);

    markOAuthCodeInFlight("abc");
    expect(hasRecentOAuthCodeMarker("abc")).toBe(true);

    clearOAuthCodeMarker("abc");
    expect(hasRecentOAuthCodeMarker("abc")).toBe(false);
  });

  it("expires stale marker", () => {
    const storage = new StorageMock();
    attachWindowStorage(storage);
    vi.spyOn(Date, "now").mockReturnValue(1000);
    markOAuthCodeInFlight("abc");

    vi.spyOn(Date, "now").mockReturnValue(1000 + 1000 * 60 * 11);
    expect(hasRecentOAuthCodeMarker("abc")).toBe(false);
  });

  it("cleans up only stale oauth markers", () => {
    const storage = new StorageMock();
    attachWindowStorage(storage);

    storage.setItem("hodam:oauth:code:old", String(0));
    storage.setItem("hodam:oauth:code:new", String(1000 + 1000 * 60 * 5));
    storage.setItem("other:key", "value");

    vi.spyOn(Date, "now").mockReturnValue(1000 + 1000 * 60 * 11);
    cleanupExpiredOAuthCodeMarkers();

    expect(storage.getItem("hodam:oauth:code:old")).toBeNull();
    expect(storage.getItem("hodam:oauth:code:new")).not.toBeNull();
    expect(storage.getItem("other:key")).toBe("value");
  });
});
