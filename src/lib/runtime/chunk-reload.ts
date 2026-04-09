const CHUNK_RELOAD_MARKER_KEY = "hodam:chunk-reload-at";
const CHUNK_RELOAD_COOLDOWN_MS = 1000 * 60 * 5;
const CHUNK_RECOVERY_QUERY_KEY = "__chunk_retry";
let hasFallbackReloadAttempt = false;

export interface ChunkFailureRecoveryDecision {
  shouldReload: boolean;
  blockedByCooldown: boolean;
}

export type ChunkFailureRecoveryAction =
  | "ignore"
  | "reload"
  | "manual_recovery";

interface LocationLike {
  href: string;
}

function toErrorMessage(input: unknown): string {
  if (!input) return "";

  if (typeof input === "string") {
    return input;
  }

  if (typeof input === "object") {
    const record = input as Record<string, unknown>;

    if (typeof record.message === "string") {
      return record.message;
    }

    if (typeof record.reason === "string") {
      return record.reason;
    }
  }

  return String(input);
}

export function isChunkLoadFailure(input: unknown): boolean {
  const message = toErrorMessage(input).toLowerCase();
  if (!message) return false;

  return (
    message.includes("loading chunk") ||
    message.includes("loading css chunk") ||
    message.includes("chunkloaderror") ||
    message.includes("failed to fetch dynamically imported module") ||
    message.includes("/_next/static/chunks/")
  );
}

export function shouldReloadForChunkFailure(
  storage: Pick<Storage, "getItem" | "setItem">,
  nowMs: number = Date.now(),
): boolean {
  const decision = resolveChunkFailureRecovery(storage, nowMs);
  return decision.shouldReload;
}

export function resolveChunkFailureRecovery(
  storage: Pick<Storage, "getItem" | "setItem">,
  nowMs: number = Date.now(),
): ChunkFailureRecoveryDecision {
  const raw = storage.getItem(CHUNK_RELOAD_MARKER_KEY);
  const lastReloadAt = Number(raw || "");
  if (
    Number.isFinite(lastReloadAt) &&
    nowMs - lastReloadAt < CHUNK_RELOAD_COOLDOWN_MS
  ) {
    return {
      shouldReload: false,
      blockedByCooldown: true,
    };
  }

  storage.setItem(CHUNK_RELOAD_MARKER_KEY, String(nowMs));
  return {
    shouldReload: true,
    blockedByCooldown: false,
  };
}

interface ResolveChunkFailureActionOptions {
  storage?: Pick<Storage, "getItem" | "setItem"> | null;
  nowMs?: number;
  fallbackReload?: () => boolean;
}

export function resolveChunkFailureAction(
  input: unknown,
  options?: ResolveChunkFailureActionOptions,
): ChunkFailureRecoveryAction {
  if (!isChunkLoadFailure(input)) {
    return "ignore";
  }

  if (options?.storage) {
    const decision = resolveChunkFailureRecovery(
      options.storage,
      options.nowMs,
    );
    return decision.shouldReload ? "reload" : "manual_recovery";
  }

  const fallbackReload =
    options?.fallbackReload || shouldReloadForChunkFailureFallback;
  return fallbackReload() ? "reload" : "manual_recovery";
}

export function shouldReloadForChunkFailureFallback(): boolean {
  if (hasFallbackReloadAttempt) {
    return false;
  }

  hasFallbackReloadAttempt = true;
  return true;
}

export function buildChunkRecoveryUrl(
  location: LocationLike,
  nowMs: number = Date.now(),
): string {
  const url = new URL(location.href);
  url.searchParams.set(CHUNK_RECOVERY_QUERY_KEY, String(nowMs));
  return url.toString();
}

export const chunkReloadInternal = {
  CHUNK_RELOAD_MARKER_KEY,
  CHUNK_RELOAD_COOLDOWN_MS,
  CHUNK_RECOVERY_QUERY_KEY,
  resetFallbackReloadAttempt() {
    hasFallbackReloadAttempt = false;
  },
};
