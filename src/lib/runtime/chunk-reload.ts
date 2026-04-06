const CHUNK_RELOAD_MARKER_KEY = "hodam:chunk-reload-at";
const CHUNK_RELOAD_COOLDOWN_MS = 1000 * 60 * 5;

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
    message.includes("chunkloaderror") ||
    message.includes("failed to fetch dynamically imported module") ||
    message.includes("/_next/static/chunks/")
  );
}

export function shouldReloadForChunkFailure(
  storage: Pick<Storage, "getItem" | "setItem">,
  nowMs: number = Date.now(),
): boolean {
  const raw = storage.getItem(CHUNK_RELOAD_MARKER_KEY);
  const lastReloadAt = Number(raw || "");
  if (
    Number.isFinite(lastReloadAt) &&
    nowMs - lastReloadAt < CHUNK_RELOAD_COOLDOWN_MS
  ) {
    return false;
  }

  storage.setItem(CHUNK_RELOAD_MARKER_KEY, String(nowMs));
  return true;
}

export const chunkReloadInternal = {
  CHUNK_RELOAD_MARKER_KEY,
  CHUNK_RELOAD_COOLDOWN_MS,
};
