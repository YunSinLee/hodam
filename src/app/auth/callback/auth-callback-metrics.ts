import type {
  AuthCallbackMetricPayload,
  AuthCallbackMetricStage,
} from "@/app/auth/callback/auth-callback-metric-contract";
import { AUTH_CALLBACK_METRIC_STAGE_SET } from "@/app/auth/callback/auth-callback-metric-contract";

const AUTH_CALLBACK_METRICS_ENDPOINT = "/api/v1/auth/callback/metrics";
const AUTH_CALLBACK_RECENT_METRICS_ENDPOINT =
  "/api/v1/auth/callback/metrics/recent";
const MAX_DEBUG_ENTRIES = 50;
const MAX_ATTEMPT_ID_LENGTH = 128;
const ATTEMPT_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

export interface AuthCallbackRecentMetricsResult {
  attemptId: string;
  events: AuthCallbackMetricPayload[];
  truncated: boolean;
  degraded: boolean;
  degradedReason: string | null;
}

declare global {
  interface Window {
    __HODAM_AUTH_CALLBACK_METRICS__?: AuthCallbackMetricPayload[];
  }
}

function isPrimitive(
  value: unknown,
): value is string | number | boolean | null {
  if (value === null) return true;
  const valueType = typeof value;
  return (
    valueType === "string" || valueType === "number" || valueType === "boolean"
  );
}

function sanitizeMetricDetails(
  details?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!details || typeof details !== "object") {
    return undefined;
  }

  const entries = Object.entries(details).slice(0, 24);
  const sanitized = entries.reduce<Record<string, unknown>>(
    (acc, [key, value]) => {
      const normalizedKey = String(key || "").trim();
      if (!normalizedKey) return acc;
      if (normalizedKey.length > 64) return acc;

      if (!isPrimitive(value)) return acc;
      if (typeof value === "string" && value.length > 200) {
        acc[normalizedKey] = `${value.slice(0, 200)}…`;
        return acc;
      }

      acc[normalizedKey] = value;
      return acc;
    },
    {},
  );

  if (Object.keys(sanitized).length === 0) {
    return undefined;
  }

  return sanitized;
}

function appendDebugMetric(payload: AuthCallbackMetricPayload) {
  if (typeof window === "undefined") return;

  const current = Array.isArray(window.__HODAM_AUTH_CALLBACK_METRICS__)
    ? window.__HODAM_AUTH_CALLBACK_METRICS__
    : [];
  const next = [...current, payload].slice(-MAX_DEBUG_ENTRIES);
  window.__HODAM_AUTH_CALLBACK_METRICS__ = next;
}

function normalizeAttemptId(value: string): string | null {
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > MAX_ATTEMPT_ID_LENGTH) return null;
  if (!ATTEMPT_ID_PATTERN.test(normalized)) return null;
  return normalized;
}

function isKnownMetricStage(value: unknown): value is AuthCallbackMetricStage {
  if (typeof value !== "string") return false;
  return AUTH_CALLBACK_METRIC_STAGE_SET.has(value);
}

function normalizeMetricPayloadArray(
  value: unknown,
): AuthCallbackMetricPayload[] {
  if (!Array.isArray(value)) return [];

  return value.reduce<AuthCallbackMetricPayload[]>((acc, item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return acc;
    }
    const payload = item as Partial<AuthCallbackMetricPayload>;
    if (!isKnownMetricStage(payload.stage)) {
      return acc;
    }
    if (
      typeof payload.callbackPath !== "string" ||
      payload.callbackPath.trim().length === 0
    ) {
      return acc;
    }
    const timestampMs = Number(payload.timestampMs);
    if (!Number.isFinite(timestampMs) || timestampMs <= 0) {
      return acc;
    }

    const normalized: AuthCallbackMetricPayload = {
      stage: payload.stage,
      callbackPath: payload.callbackPath,
      timestampMs: Math.floor(timestampMs),
    };
    if (payload.details && typeof payload.details === "object") {
      normalized.details = sanitizeMetricDetails(
        payload.details as Record<string, unknown>,
      );
    }
    acc.push(normalized);
    return acc;
  }, []);
}

function mergeMetrics(
  first: AuthCallbackMetricPayload[],
  second: AuthCallbackMetricPayload[],
): AuthCallbackMetricPayload[] {
  const map = new Map<string, AuthCallbackMetricPayload>();

  [...first, ...second].forEach(metric => {
    const key = `${metric.timestampMs}:${metric.stage}:${metric.callbackPath}`;
    if (!map.has(key)) {
      map.set(key, metric);
    }
  });

  return Array.from(map.values())
    .sort((left, right) => left.timestampMs - right.timestampMs)
    .slice(-MAX_DEBUG_ENTRIES);
}

export async function fetchAuthCallbackRecentMetrics(
  attemptId: string,
  options?: {
    limit?: number;
    signal?: AbortSignal;
  },
): Promise<AuthCallbackRecentMetricsResult | null> {
  const normalizedAttemptId = normalizeAttemptId(attemptId);
  if (!normalizedAttemptId) return null;

  const limit =
    typeof options?.limit === "number" && Number.isFinite(options.limit)
      ? Math.min(60, Math.max(1, Math.floor(options.limit)))
      : 20;

  const searchParams = new URLSearchParams({
    attemptId: normalizedAttemptId,
    limit: String(limit),
  });

  try {
    const response = await fetch(
      `${AUTH_CALLBACK_RECENT_METRICS_ENDPOINT}?${searchParams.toString()}`,
      {
        method: "GET",
        cache: "no-store",
        signal: options?.signal,
      },
    );
    if (!response.ok) return null;

    const payload = (await response.json()) as {
      attemptId?: unknown;
      events?: unknown;
      truncated?: unknown;
      degraded?: unknown;
      degradedReason?: unknown;
    };
    if (
      typeof payload.attemptId !== "string" ||
      payload.attemptId.trim().length === 0
    ) {
      return null;
    }

    let degradedReason: string | null = null;
    if (typeof payload.degradedReason === "string") {
      degradedReason = payload.degradedReason;
    } else if (payload.degradedReason === null) {
      degradedReason = null;
    }

    return {
      attemptId: payload.attemptId,
      events: normalizeMetricPayloadArray(payload.events),
      truncated: Boolean(payload.truncated),
      degraded: Boolean(payload.degraded),
      degradedReason,
    };
  } catch {
    return null;
  }
}

export function appendFetchedAuthCallbackMetrics(
  fetchedEvents: AuthCallbackMetricPayload[],
) {
  if (typeof window === "undefined") return;
  const current = Array.isArray(window.__HODAM_AUTH_CALLBACK_METRICS__)
    ? window.__HODAM_AUTH_CALLBACK_METRICS__
    : [];
  window.__HODAM_AUTH_CALLBACK_METRICS__ = mergeMetrics(current, fetchedEvents);
}

export function createAuthCallbackMetricEmitter(callbackUrl: URL | null) {
  const callbackPath =
    callbackUrl?.pathname ||
    (typeof window !== "undefined"
      ? window.location.pathname
      : "/auth/callback");
  const debugEnabled =
    callbackUrl?.searchParams.get("auth_debug") === "1" ||
    process.env.NEXT_PUBLIC_AUTH_CALLBACK_DEBUG === "1";

  return (
    stage: AuthCallbackMetricStage,
    details?: Record<string, unknown>,
  ) => {
    if (typeof window === "undefined") return;

    const payload: AuthCallbackMetricPayload = {
      stage,
      callbackPath,
      timestampMs: Date.now(),
      details: sanitizeMetricDetails(details),
    };

    if (debugEnabled) {
      appendDebugMetric(payload);
    }

    fetch(AUTH_CALLBACK_METRICS_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      // Metrics are best-effort for callback diagnostics.
    });
  };
}
