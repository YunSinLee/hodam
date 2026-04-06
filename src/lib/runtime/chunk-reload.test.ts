import { describe, expect, it } from "vitest";

import {
  chunkReloadInternal,
  isChunkLoadFailure,
  shouldReloadForChunkFailure,
} from "@/lib/runtime/chunk-reload";

describe("isChunkLoadFailure", () => {
  it("detects known chunk loading error messages", () => {
    expect(isChunkLoadFailure("Loading chunk app/(home)/page failed.")).toBe(
      true,
    );
    expect(isChunkLoadFailure("ChunkLoadError: Loading chunk 123 failed")).toBe(
      true,
    );
    expect(
      isChunkLoadFailure(
        "Failed to fetch dynamically imported module: /_next/static/chunks/a.js",
      ),
    ).toBe(true);
  });

  it("detects errors from objects", () => {
    expect(
      isChunkLoadFailure({ message: "Loading chunk app/page failed." }),
    ).toBe(true);
    expect(
      isChunkLoadFailure({
        reason: "ChunkLoadError: Loading chunk app/(home)/page failed.",
      }),
    ).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isChunkLoadFailure("Network Error")).toBe(false);
    expect(isChunkLoadFailure({ message: "Unauthorized" })).toBe(false);
    expect(isChunkLoadFailure(null)).toBe(false);
  });
});

describe("shouldReloadForChunkFailure", () => {
  it("allows first reload then blocks within cooldown window", () => {
    const map = new Map<string, string>();
    const storage = {
      getItem: (key: string) => map.get(key) || null,
      setItem: (key: string, value: string) => {
        map.set(key, value);
      },
    };

    const now = Date.now();

    expect(shouldReloadForChunkFailure(storage, now)).toBe(true);
    expect(shouldReloadForChunkFailure(storage, now + 1000)).toBe(false);
  });

  it("allows reload after cooldown elapsed", () => {
    const map = new Map<string, string>();
    const storage = {
      getItem: (key: string) => map.get(key) || null,
      setItem: (key: string, value: string) => {
        map.set(key, value);
      },
    };
    const now = Date.now();
    storage.setItem(chunkReloadInternal.CHUNK_RELOAD_MARKER_KEY, String(now));

    expect(
      shouldReloadForChunkFailure(
        storage,
        now + chunkReloadInternal.CHUNK_RELOAD_COOLDOWN_MS + 1,
      ),
    ).toBe(true);
  });

  it("handles malformed marker value safely", () => {
    const map = new Map<string, string>();
    const storage = {
      getItem: (key: string) => map.get(key) || null,
      setItem: (key: string, value: string) => {
        map.set(key, value);
      },
    };
    storage.setItem(
      chunkReloadInternal.CHUNK_RELOAD_MARKER_KEY,
      "not-a-number",
    );

    expect(shouldReloadForChunkFailure(storage, Date.now())).toBe(true);
  });
});
