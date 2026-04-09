import { NextRequest } from "next/server";

import type {
  AuthCallbackMetricPayload,
  AuthCallbackMetricStage,
} from "@/app/auth/callback/auth-callback-metric-contract";
import { AUTH_CALLBACK_METRIC_STAGE_SET } from "@/app/auth/callback/auth-callback-metric-contract";
import { normalizeOAuthProviderName } from "@/lib/auth/oauth-provider";
import { logError, logInfo } from "@/lib/server/logger";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { createApiRequestContext } from "@/lib/server/request-context";
import {
  createSupabaseAdminClient,
  createSupabaseAnonServerClient,
} from "@/lib/supabase/server";

type ActivityLogRow = {
  action?: unknown;
  details?: unknown;
  created_at?: unknown;
};

type ActivityMetricDetailPrimitive = string | number | boolean | null;

const AUTH_CALLBACK_METRIC_ACTIONS = [
  "auth_callback_event",
  "auth_callback_success",
  "auth_callback_error",
] as const;
const DEFAULT_FETCH_LIMIT = 20;
const MAX_FETCH_LIMIT = 60;
const MAX_ATTEMPT_ID_LENGTH = 128;
const MIN_ATTEMPT_ID_LENGTH = 8;
const ATTEMPT_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;
const AUTH_CALLBACK_LOOKBACK_MS = 1000 * 60 * 60 * 24;
const MAX_DETAIL_ENTRIES = 24;
const MAX_DETAIL_KEY_LENGTH = 64;
const MAX_DETAIL_VALUE_LENGTH = 200;

interface QueryRowsResult {
  rows: ActivityLogRow[];
  degraded: boolean;
  degradedReason: string | null;
}

function getRateLimitKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const candidate = (forwarded?.split(",")[0] || realIp || "").trim();
  return candidate || "unknown";
}

function parseSearchParams(request: NextRequest): URLSearchParams {
  try {
    return new URL(request.url).searchParams;
  } catch {
    return new URL(request.url, "http://localhost").searchParams;
  }
}

function normalizeAttemptId(raw: string | null): string | null {
  if (!raw) return null;
  const normalized = raw.trim();
  if (normalized.length < MIN_ATTEMPT_ID_LENGTH) return null;
  if (normalized.length > MAX_ATTEMPT_ID_LENGTH) return null;
  if (!ATTEMPT_ID_PATTERN.test(normalized)) return null;
  return normalized;
}

function normalizeLimit(raw: string | null): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_FETCH_LIMIT;
  }
  const integerValue = Math.floor(parsed);
  return Math.min(MAX_FETCH_LIMIT, integerValue);
}

function normalizeDetails(
  details: unknown,
): Record<string, ActivityMetricDetailPrimitive> {
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return {};
  }

  const entries = Object.entries(details as Record<string, unknown>).slice(
    0,
    MAX_DETAIL_ENTRIES,
  );

  return entries.reduce<Record<string, ActivityMetricDetailPrimitive>>(
    (acc, [key, value]) => {
      const normalizedKey = String(key || "").trim();
      if (!normalizedKey || normalizedKey.length > MAX_DETAIL_KEY_LENGTH) {
        return acc;
      }

      if (
        value === null ||
        typeof value === "boolean" ||
        typeof value === "number"
      ) {
        acc[normalizedKey] = value;
        return acc;
      }

      if (typeof value === "string") {
        if (normalizedKey === "provider") {
          const provider = normalizeOAuthProviderName(value);
          if (provider) {
            acc[normalizedKey] = provider;
          }
          return acc;
        }

        acc[normalizedKey] =
          value.length > MAX_DETAIL_VALUE_LENGTH
            ? `${value.slice(0, MAX_DETAIL_VALUE_LENGTH)}…`
            : value;
      }

      return acc;
    },
    {},
  );
}

function resolveStage(
  details: Record<string, ActivityMetricDetailPrimitive>,
  action: string,
): AuthCallbackMetricPayload["stage"] | null {
  const detailStage = details.stage;

  if (isAuthCallbackMetricStage(detailStage)) {
    return detailStage;
  }

  if (action === "auth_callback_success") {
    return "callback_success";
  }
  if (action === "auth_callback_error") {
    return "callback_error";
  }
  return null;
}

function isAuthCallbackMetricStage(
  value: unknown,
): value is AuthCallbackMetricStage {
  if (typeof value !== "string") return false;
  return AUTH_CALLBACK_METRIC_STAGE_SET.has(value);
}

function resolveTimestampMs(
  details: Record<string, ActivityMetricDetailPrimitive>,
  createdAt: string,
): number {
  const candidate = details.timestampMs;
  if (
    typeof candidate === "number" &&
    Number.isFinite(candidate) &&
    candidate > 0
  ) {
    return Math.floor(candidate);
  }

  const parsedCreatedAt = Date.parse(createdAt);
  if (Number.isFinite(parsedCreatedAt) && parsedCreatedAt > 0) {
    return parsedCreatedAt;
  }

  return Date.now();
}

function toMetricPayload(
  row: ActivityLogRow,
): AuthCallbackMetricPayload | null {
  const action = typeof row.action === "string" ? row.action : "";
  if (!AUTH_CALLBACK_METRIC_ACTIONS.includes(action as never)) {
    return null;
  }

  const createdAt =
    typeof row.created_at === "string" && row.created_at.trim().length > 0
      ? row.created_at
      : new Date().toISOString();
  const details = normalizeDetails(row.details);
  const stage = resolveStage(details, action);
  if (!stage) return null;

  const callbackPath =
    typeof details.callbackPath === "string" && details.callbackPath.trim()
      ? details.callbackPath.trim()
      : "/auth/callback";
  const timestampMs = resolveTimestampMs(details, createdAt);

  return {
    stage,
    callbackPath,
    timestampMs,
    details,
  };
}

async function readRowsFromRpc(attemptId: string, limit: number) {
  const anon = createSupabaseAnonServerClient();
  const { data, error } = await anon.rpc(
    "get_auth_callback_metrics_by_attempt",
    {
      p_attempt_id: attemptId,
      p_limit: limit + 1,
    },
  );

  return {
    rows: Array.isArray(data) ? (data as ActivityLogRow[]) : [],
    error,
  };
}

async function readRowsFromAdminQuery(
  attemptId: string,
  limit: number,
  lookbackIso: string,
): Promise<ActivityLogRow[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("user_activity_logs")
    .select("action, details, created_at")
    .gte("created_at", lookbackIso)
    .in("action", [...AUTH_CALLBACK_METRIC_ACTIONS])
    .eq("details->>oauthAttemptId", attemptId)
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? (data as ActivityLogRow[]) : [];
}

async function readRows(params: {
  attemptId: string;
  limit: number;
  lookbackIso: string;
  requestId: string;
}): Promise<QueryRowsResult> {
  const { attemptId, limit, lookbackIso, requestId } = params;
  try {
    const rpcResult = await readRowsFromRpc(attemptId, limit);
    if (!rpcResult.error) {
      return {
        rows: rpcResult.rows,
        degraded: false,
        degradedReason: null,
      };
    }

    logInfo("/api/v1/auth/callback/metrics/recent", {
      requestId,
      attemptId,
      outcome: "rpc_failed_fallback_to_admin",
      reason:
        rpcResult.error instanceof Error
          ? rpcResult.error.message
          : String(rpcResult.error),
    });
  } catch (rpcThrownError) {
    logInfo("/api/v1/auth/callback/metrics/recent", {
      requestId,
      attemptId,
      outcome: "rpc_threw_fallback_to_admin",
      reason:
        rpcThrownError instanceof Error
          ? rpcThrownError.message
          : String(rpcThrownError),
    });
  }

  try {
    const rows = await readRowsFromAdminQuery(attemptId, limit, lookbackIso);
    return {
      rows,
      degraded: false,
      degradedReason: null,
    };
  } catch (adminError) {
    const normalizedReason =
      adminError instanceof Error &&
      adminError.message.includes("SUPABASE_SERVICE_ROLE_KEY")
        ? "metrics_source_unavailable"
        : "fetch_failed";
    logInfo("/api/v1/auth/callback/metrics/recent", {
      requestId,
      attemptId,
      outcome: "admin_fallback_failed",
      degradedReason: normalizedReason,
      reason:
        adminError instanceof Error ? adminError.message : String(adminError),
    });
    if (normalizedReason === "fetch_failed") {
      logError("/api/v1/auth/callback/metrics/recent", adminError, {
        requestId,
        attemptId,
        limit,
      });
    }
    return {
      rows: [],
      degraded: true,
      degradedReason: normalizedReason,
    };
  }
}

export async function GET(request: NextRequest) {
  const { failWithCode, ok, requestId } = createApiRequestContext(request);
  const rateLimitKey = getRateLimitKey(request);

  if (
    !checkRateLimit(`auth-callback:metrics-recent:${rateLimitKey}`, 60, 60_000)
  ) {
    return failWithCode(
      429,
      "Too many auth callback diagnostics requests",
      "AUTH_CALLBACK_METRICS_RATE_LIMITED",
    );
  }

  const searchParams = parseSearchParams(request);
  const attemptId = normalizeAttemptId(
    (
      searchParams.get("attemptId") ||
      searchParams.get("oauthAttemptId") ||
      ""
    ).trim(),
  );
  if (!attemptId) {
    return failWithCode(
      400,
      "Invalid auth callback attempt id",
      "AUTH_CALLBACK_ATTEMPT_ID_INVALID",
    );
  }

  const limit = normalizeLimit(searchParams.get("limit"));
  const lookbackIso = new Date(
    Date.now() - AUTH_CALLBACK_LOOKBACK_MS,
  ).toISOString();
  const queryResult = await readRows({
    attemptId,
    limit,
    lookbackIso,
    requestId,
  });
  const truncated = queryResult.rows.length > limit;
  const metrics = queryResult.rows
    .slice(0, limit)
    .map(row => toMetricPayload(row as ActivityLogRow))
    .filter((payload): payload is AuthCallbackMetricPayload => Boolean(payload))
    .reverse();

  return ok({
    attemptId,
    events: metrics,
    truncated,
    degraded: queryResult.degraded,
    degradedReason: queryResult.degradedReason,
  });
}
