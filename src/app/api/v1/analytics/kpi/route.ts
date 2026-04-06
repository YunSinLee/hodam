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
  const { fail, ok, requestId } = createApiRequestContext(request);
  const auth = await authenticateRequest(request);
  if (!auth) {
    return fail(401, "Unauthorized");
  }

  if (!checkRateLimit(`analytics:kpi:${auth.userId}`, 60, 60_000)) {
    return fail(429, "Too many KPI requests");
  }

  const days = parseDaysParam(request.nextUrl.searchParams.get("days"));

  try {
    const userClient = requireUserClient(auth.accessToken);

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
          { requestId, userId: auth.userId },
        ),
        queryViewWithGracefulFallback(
          () =>
            userClient
              .from("kpi_retention_daily")
              .select("*")
              .order("cohort_date", { ascending: false })
              .limit(days),
          "kpi_retention_daily_error",
          { requestId, userId: auth.userId },
        ),
        queryViewWithGracefulFallback(
          () =>
            userClient
              .from("kpi_user_retention")
              .select("*")
              .eq("user_id", auth.userId)
              .limit(1),
          "kpi_user_retention_error",
          { requestId, userId: auth.userId },
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
      userId: auth.userId,
    });
    return fail(500, "Failed to fetch KPI metrics");
  }
}
