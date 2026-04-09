import { describe, expect, it } from "vitest";

import {
  buildChunkRecoveryUrl,
  chunkReloadInternal,
  isChunkLoadFailure,
  resolveChunkFailureAction,
  resolveChunkFailureRecovery,
  shouldReloadForChunkFailureFallback,
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
    expect(isChunkLoadFailure("Loading CSS chunk app/layout failed.")).toBe(
      true,
    );
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

describe("shouldReloadForChunkFailureFallback", () => {
  it("allows one fallback reload attempt then blocks", () => {
    chunkReloadInternal.resetFallbackReloadAttempt();
    expect(shouldReloadForChunkFailureFallback()).toBe(true);
    expect(shouldReloadForChunkFailureFallback()).toBe(false);
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

describe("resolveChunkFailureRecovery", () => {
  it("returns blockedByCooldown when reload is suppressed", () => {
    const map = new Map<string, string>();
    const storage = {
      getItem: (key: string) => map.get(key) || null,
      setItem: (key: string, value: string) => {
        map.set(key, value);
      },
    };
    const now = Date.now();
    storage.setItem(chunkReloadInternal.CHUNK_RELOAD_MARKER_KEY, String(now));

    expect(resolveChunkFailureRecovery(storage, now + 500)).toEqual({
      shouldReload: false,
      blockedByCooldown: true,
    });
  });

  it("returns reload decision after cooldown elapsed", () => {
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
      resolveChunkFailureRecovery(
        storage,
        now + chunkReloadInternal.CHUNK_RELOAD_COOLDOWN_MS + 1,
      ),
    ).toEqual({
      shouldReload: true,
      blockedByCooldown: false,
    });
  });
});

describe("resolveChunkFailureAction", () => {
  const chunkError = "Loading chunk app/(home)/page failed.";

  it("returns ignore for non chunk failures", () => {
    expect(
      resolveChunkFailureAction("Unauthorized", {
        fallbackReload: () => true,
      }),
    ).toBe("ignore");
  });

  it("returns reload for first storage-backed chunk failure", () => {
    const map = new Map<string, string>();
    const storage = {
      getItem: (key: string) => map.get(key) || null,
      setItem: (key: string, value: string) => {
        map.set(key, value);
      },
    };

    expect(resolveChunkFailureAction(chunkError, { storage })).toBe("reload");
  });

  it("returns manual recovery when storage cooldown blocks reload", () => {
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
      resolveChunkFailureAction(chunkError, { storage, nowMs: now + 500 }),
    ).toBe("manual_recovery");
  });

  it("returns manual recovery after fallback reload already attempted", () => {
    chunkReloadInternal.resetFallbackReloadAttempt();

    expect(resolveChunkFailureAction(chunkError)).toBe("reload");
    expect(resolveChunkFailureAction(chunkError)).toBe("manual_recovery");
  });
});

describe("buildChunkRecoveryUrl", () => {
  it("adds retry query while preserving existing query and hash", () => {
    const url = buildChunkRecoveryUrl(
      {
        href: "https://example.com/my-story?foo=1#section",
      },
      12345,
    );
    const parsed = new URL(url);

    expect(parsed.pathname).toBe("/my-story");
    expect(parsed.searchParams.get("foo")).toBe("1");
    expect(
      parsed.searchParams.get(chunkReloadInternal.CHUNK_RECOVERY_QUERY_KEY),
    ).toBe("12345");
    expect(parsed.hash).toBe("#section");
  });

  it("replaces previous retry query value", () => {
    const url = buildChunkRecoveryUrl(
      {
        href: "https://example.com/service?__chunk_retry=1",
      },
      999,
    );
    const parsed = new URL(url);

    expect(
      parsed.searchParams.get(chunkReloadInternal.CHUNK_RECOVERY_QUERY_KEY),
    ).toBe("999");
  });
});
