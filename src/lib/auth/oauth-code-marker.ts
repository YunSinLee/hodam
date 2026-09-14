const OAUTH_CODE_MARKER_PREFIX = "hodam:oauth:code:";
const OAUTH_CODE_MARKER_TTL_MS = 1000 * 60 * 10;

function getSessionStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function withCodeMarkerKey(code: string): string {
  return `${OAUTH_CODE_MARKER_PREFIX}${code}`;
}

function readCodeMarker(code: string): number | null {
  const storage = getSessionStorage();
  if (!storage) return null;

  const raw = storage.getItem(withCodeMarkerKey(code));
  if (!raw) return null;
  const timestamp = Number(raw);
  if (!Number.isFinite(timestamp)) return null;
  return timestamp;
}

export function markOAuthCodeInFlight(code: string): void {
  const storage = getSessionStorage();
  if (!storage) return;
  storage.setItem(withCodeMarkerKey(code), String(Date.now()));
}

export function clearOAuthCodeMarker(code: string): void {
  const storage = getSessionStorage();
  if (!storage) return;
  storage.removeItem(withCodeMarkerKey(code));
}

export function hasRecentOAuthCodeMarker(code: string): boolean {
  const markerTimestamp = readCodeMarker(code);
  if (!markerTimestamp) return false;

  if (Date.now() - markerTimestamp > OAUTH_CODE_MARKER_TTL_MS) {
    clearOAuthCodeMarker(code);
    return false;
  }

  return true;
}

export function cleanupExpiredOAuthCodeMarkers(): void {
  const storage = getSessionStorage();
  if (!storage) return;

  const now = Date.now();
  const total = storage.length;
  const keys: string[] = [];
  for (let i = 0; i < total; i += 1) {
    const key = storage.key(i);
    if (key) keys.push(key);
  }

  keys.forEach(key => {
    if (!key.startsWith(OAUTH_CODE_MARKER_PREFIX)) return;
    const raw = storage.getItem(key);
    const timestamp = Number(raw || "");
    if (
      !Number.isFinite(timestamp) ||
      now - timestamp > OAUTH_CODE_MARKER_TTL_MS
    ) {
      storage.removeItem(key);
    }
  });
}
