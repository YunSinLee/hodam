import { NextRequest } from "next/server";

import {
  authenticateRequest,
  requireUserClient,
} from "@/lib/auth/request-auth";
import { logError } from "@/lib/server/logger";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { createApiRequestContext } from "@/lib/server/request-context";

const DEFAULT_DAYS = 14;
const MAX_DAYS = 90;

function parseDaysParam(raw: string | null): number {
  if (!raw) return DEFAULT_DAYS;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_DAYS;
  }

  return Math.min(Math.floor(parsed), MAX_DAYS);
}

type QueryResult = {
  rows: Record<string, unknown>[];
  degradedReason?: string;
};

async function queryViewWithGracefulFallback(
  queryFactory: () => PromiseLike<{
    data: Record<string, unknown>[] | null;
    error: { message?: string } | null;
  }>,
  degradedReason: string,
  logContext?: Record<string, unknown>,
): Promise<QueryResult> {
  try {
    const { data, error } = await queryFactory();
    if (error) {
      logError(`kpi view query failed (${degradedReason})`, error, logContext);
      return { rows: [], degradedReason };
    }
    return { rows: data || [] };
  } catch (error) {
    logError(`kpi view query threw (${degradedReason})`, error, logContext);
    return { rows: [], degradedReason };
  }
}

export async function GET(request: NextRequest) {
  const { failWithCode, ok, requestId } = createApiRequestContext(request);
  let auth: Awaited<ReturnType<typeof authenticateRequest>> = null;
  try {
    auth = await authenticateRequest(request);
  } catch (error) {
    logError("/api/v1/analytics/kpi authenticateRequest", error, { requestId });
    return failWithCode(401, "Unauthorized", "AUTH_UNAUTHORIZED");
  }
  if (!auth) {
    return failWithCode(401, "Unauthorized", "AUTH_UNAUTHORIZED");
  }
  const authContext = auth;

  if (!checkRateLimit(`analytics:kpi:${authContext.userId}`, 60, 60_000)) {
    return failWithCode(429, "Too many KPI requests", "KPI_RATE_LIMITED");
  }

  const days = parseDaysParam(request.nextUrl.searchParams.get("days"));

  try {
    const userClient = requireUserClient(authContext.accessToken);

    const [dailyResult, retentionDailyResult, userRetentionResult] =
      await Promise.all([
        queryViewWithGracefulFallback(
          () =>
            userClient
              .from("kpi_daily")
              .select("*")
              .order("metric_date", { ascending: false })
              .limit(days),
          "kpi_daily_error",
          { requestId, userId: authContext.userId },
        ),
        queryViewWithGracefulFallback(
          () =>
            userClient
              .from("kpi_retention_daily")
              .select("*")
              .order("cohort_date", { ascending: false })
              .limit(days),
          "kpi_retention_daily_error",
          { requestId, userId: authContext.userId },
        ),
        queryViewWithGracefulFallback(
          () =>
            userClient
              .from("kpi_user_retention")
              .select("*")
              .eq("user_id", authContext.userId)
              .limit(1),
          "kpi_user_retention_error",
          { requestId, userId: authContext.userId },
        ),
      ]);

    const degradedReasons = [
      dailyResult.degradedReason,
      retentionDailyResult.degradedReason,
      userRetentionResult.degradedReason,
    ].filter((reason): reason is string => Boolean(reason));

    const headers = new Headers();
    if (degradedReasons.length > 0) {
      headers.set("x-hodam-kpi-degraded", "1");
      headers.set(
        "x-hodam-kpi-degraded-reasons",
        Array.from(new Set(degradedReasons)).join(","),
      );
    }

    return ok(
      {
        days,
        daily: dailyResult.rows,
        retentionDaily: retentionDailyResult.rows,
        userRetention: userRetentionResult.rows[0] || null,
      },
      { headers },
    );
  } catch (error) {
    logError("/api/v1/analytics/kpi", error, {
      requestId,
      userId: authContext.userId,
    });
    return failWithCode(500, "Failed to fetch KPI metrics", "KPI_FETCH_FAILED");
  }
}
