import {
  normalizeOAuthProviderName,
  type OAuthProviderName,
} from "@/lib/auth/oauth-provider";

const OAUTH_PROVIDER_MARKER_KEY = "hodam:oauth:provider";
const OAUTH_PROVIDER_MARKER_TTL_MS = 1000 * 60 * 15;
const MAX_OAUTH_ATTEMPT_ID_LENGTH = 128;

interface OAuthProviderMarkerPayload {
  provider: OAuthProviderName;
  timestampMs: number;
  attemptId: string;
}

export interface RecentOAuthProviderMarker {
  provider: OAuthProviderName;
  timestampMs: number;
  attemptId: string;
}

function getSessionStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function createOAuthAttemptId(): string {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  const randomPart = Math.random().toString(36).slice(2, 10);
  return `oauth_${Date.now().toString(36)}_${randomPart}`;
}

function normalizeAttemptId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > MAX_OAUTH_ATTEMPT_ID_LENGTH) {
    return normalized.slice(0, MAX_OAUTH_ATTEMPT_ID_LENGTH);
  }
  return normalized;
}

function readMarkerPayload(): RecentOAuthProviderMarker | null {
  const storage = getSessionStorage();
  if (!storage) return null;

  const raw = storage.getItem(OAUTH_PROVIDER_MARKER_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as {
      provider?: unknown;
      timestampMs?: unknown;
      attemptId?: unknown;
    };
    const provider = normalizeOAuthProviderName(parsed.provider);
    const timestampMs = Number(parsed.timestampMs);
    const attemptId = normalizeAttemptId(parsed.attemptId);
    if (!provider || !Number.isFinite(timestampMs) || timestampMs <= 0) {
      return null;
    }
    return {
      provider,
      timestampMs,
      attemptId: attemptId || "",
    };
  } catch {
    return null;
  }
}

export function markOAuthProvider(provider: OAuthProviderName): string {
  const storage = getSessionStorage();
  const attemptId = createOAuthAttemptId();
  if (!storage) return attemptId;

  const payload: OAuthProviderMarkerPayload = {
    provider,
    timestampMs: Date.now(),
    attemptId,
  };
  storage.setItem(OAUTH_PROVIDER_MARKER_KEY, JSON.stringify(payload));
  return attemptId;
}

export function clearOAuthProviderMarker(): void {
  const storage = getSessionStorage();
  if (!storage) return;
  storage.removeItem(OAUTH_PROVIDER_MARKER_KEY);
}

export function readRecentOAuthProviderMarker(): RecentOAuthProviderMarker | null {
  const payload = readMarkerPayload();
  if (!payload) return null;

  if (Date.now() - payload.timestampMs > OAUTH_PROVIDER_MARKER_TTL_MS) {
    clearOAuthProviderMarker();
    return null;
  }

  return payload;
}

export function readRecentOAuthProvider(): OAuthProviderName | null {
  return readRecentOAuthProviderMarker()?.provider || null;
}

export function readRecentOAuthAttemptId(): string | null {
  const attemptId = readRecentOAuthProviderMarker()?.attemptId || "";
  return attemptId || null;
}
