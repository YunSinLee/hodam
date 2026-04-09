import { NextRequest } from "next/server";

import { AUTH_CALLBACK_METRIC_STAGE_SET } from "@/app/auth/callback/auth-callback-metric-contract";
import { normalizeOAuthProviderName } from "@/lib/auth/oauth-provider";
import { trackActivity } from "@/lib/server/analytics";
import { logInfo } from "@/lib/server/logger";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { createApiRequestContext } from "@/lib/server/request-context";
import {
  createSupabaseAdminClient,
  createSupabaseAnonServerClient,
} from "@/lib/supabase/server";

interface AuthCallbackMetricBody {
  stage?: unknown;
  callbackPath?: unknown;
  timestampMs?: unknown;
  details?: unknown;
}

const AUTH_CALLBACK_ERROR_STAGES = new Set([
  "oauth_error",
  "exchange_terminal_error",
  "callback_error",
  "fallback_timeout_triggered",
]);

function toAuthCallbackActivityAction(stage: string) {
  if (stage === "callback_success") {
    return "auth_callback_success";
  }
  if (AUTH_CALLBACK_ERROR_STAGES.has(stage)) {
    return "auth_callback_error";
  }
  return "auth_callback_event";
}

function getRateLimitKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const candidate = (forwarded?.split(",")[0] || realIp || "").trim();
  return candidate || "unknown";
}

function normalizeMetricDetails(
  details: unknown,
): Record<string, string | number | boolean | null> {
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return {};
  }

  const entries = Object.entries(details as Record<string, unknown>).slice(
    0,
    24,
  );
  return entries.reduce<Record<string, string | number | boolean | null>>(
    (acc, [key, value]) => {
      const normalizedKey = String(key || "").trim();
      if (!normalizedKey || normalizedKey.length > 64) {
        return acc;
      }

      if (
        value === null ||
        typeof value === "boolean" ||
        typeof value === "number"
      ) {
        if (normalizedKey === "provider") {
          return acc;
        }
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
          value.length > 200 ? `${value.slice(0, 200)}…` : value;
      }

      return acc;
    },
    {},
  );
}

export async function POST(request: NextRequest) {
  const { failWithCode, ok, requestId } = createApiRequestContext(request);

  const rateLimitKey = getRateLimitKey(request);
  if (!checkRateLimit(`auth-callback:metrics:${rateLimitKey}`, 240, 60_000)) {
    return failWithCode(
      429,
      "Too many auth callback diagnostics requests",
      "AUTH_CALLBACK_METRICS_RATE_LIMITED",
    );
  }

  let body: AuthCallbackMetricBody;
  try {
    body = (await request.json()) as AuthCallbackMetricBody;
  } catch {
    return failWithCode(400, "Invalid JSON body", "REQUEST_JSON_INVALID");
  }

  const stage = typeof body.stage === "string" ? body.stage : "";
  if (!stage || !AUTH_CALLBACK_METRIC_STAGE_SET.has(stage)) {
    return failWithCode(
      400,
      "Invalid auth callback metric stage",
      "AUTH_CALLBACK_METRIC_STAGE_INVALID",
    );
  }

  const callbackPath =
    typeof body.callbackPath === "string" && body.callbackPath.trim().length > 0
      ? body.callbackPath.trim().slice(0, 256)
      : "/auth/callback";
  const timestampMs = Number(body.timestampMs);
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) {
    return failWithCode(
      400,
      "Invalid auth callback metric timestamp",
      "AUTH_CALLBACK_METRIC_TIMESTAMP_INVALID",
    );
  }

  const details = normalizeMetricDetails(body.details);
  const activityAction = toAuthCallbackActivityAction(stage);
  let persistedSource: "admin" | "rpc" | "none" = "none";

  try {
    const admin = createSupabaseAdminClient();
    await trackActivity(admin, {
      action: activityAction,
      details: {
        stage,
        callbackPath,
        timestampMs,
        ...details,
      },
      request,
    });
    persistedSource = "admin";
  } catch {
    // Fall through to RPC fallback below.
  }

  if (persistedSource === "none") {
    try {
      const anon = createSupabaseAnonServerClient();
      const { data, error } = await anon.rpc("record_auth_callback_metric", {
        p_stage: stage,
        p_callback_path: callbackPath,
        p_timestamp_ms: Math.floor(timestampMs),
        p_details: details,
      });
      if (!error && data === true) {
        persistedSource = "rpc";
      }
    } catch {
      // Ignore fallback transport failures.
    }
  }

  logInfo("/api/v1/auth/callback/metrics", {
    requestId,
    action: activityAction,
    stage,
    callbackPath,
    timestampMs,
    details,
    persistedSource,
  });

  return ok({
    accepted: true,
  });
}
