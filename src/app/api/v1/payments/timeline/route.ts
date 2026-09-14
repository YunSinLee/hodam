import { NextRequest } from "next/server";

import { authenticateRequest } from "@/lib/auth/request-auth";
import {
  buildPaymentFlowHeaders,
  readPaymentFlowIdFromHeaders,
  resolvePaymentFlowId,
} from "@/lib/payments/flow-diagnostics";
import { logError, logInfo } from "@/lib/server/logger";
import {
  getLatestPaymentByFlowId,
  getPaymentByOrderId,
  listWebhookTransmissionsByOrder,
} from "@/lib/server/payment-service";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { createApiRequestContext } from "@/lib/server/request-context";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type TimelineEventType =
  | "payment_created"
  | "payment_completed"
  | "payment_failed"
  | "payment_cancelled"
  | "webhook_received";

type TimelineLookupMode = "order_id" | "payment_flow_id";

interface TimelineEvent {
  type: TimelineEventType;
  source: "payment_history" | "webhook_transmissions";
  timestamp: string;
  details?: Record<string, unknown>;
}

const TIMELINE_LOOKUP_MODE_HEADER = "x-hodam-payment-timeline-lookup-mode";
const TIMELINE_DEGRADED_HEADER = "x-hodam-payment-timeline-degraded";
const TIMELINE_DEGRADED_REASON_HEADER =
  "x-hodam-payment-timeline-degraded-reason";

function isPermissionDenied(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code =
    "code" in error && typeof error.code === "string" ? error.code : null;
  if (code === "42501") return true;

  const message =
    "message" in error && typeof error.message === "string"
      ? error.message
      : null;
  if (!message) return false;
  return message.toLowerCase().includes("permission denied");
}

function parseSearchParams(request: NextRequest): URLSearchParams {
  const rawUrl = request.url || "http://localhost";
  try {
    return new URL(rawUrl).searchParams;
  } catch {
    return new URL(rawUrl, "http://localhost").searchParams;
  }
}

function sortByTimestampAsc(events: TimelineEvent[]): TimelineEvent[] {
  return [...events].sort((left, right) => {
    const leftTime = Date.parse(left.timestamp);
    const rightTime = Date.parse(right.timestamp);

    if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) return 0;
    if (Number.isNaN(leftTime)) return 1;
    if (Number.isNaN(rightTime)) return -1;
    return leftTime - rightTime;
  });
}

function resolveLookupMode(
  orderId: string,
  paymentFlowIdQuery: string,
): TimelineLookupMode | null {
  if (orderId) {
    return "order_id";
  }
  if (paymentFlowIdQuery) {
    return "payment_flow_id";
  }
  return null;
}

function buildTimelineHeaders(params: {
  flowId: string;
  lookupMode: TimelineLookupMode | null;
  degradedReason?: string | null;
}): Headers {
  const headers = buildPaymentFlowHeaders("timeline", params.flowId);
  const normalizedReason = params.degradedReason || "";

  if (params.lookupMode) {
    headers.set(TIMELINE_LOOKUP_MODE_HEADER, params.lookupMode);
  }

  headers.set(TIMELINE_DEGRADED_HEADER, normalizedReason ? "1" : "0");
  headers.set(TIMELINE_DEGRADED_REASON_HEADER, normalizedReason);

  return headers;
}

export async function GET(request: NextRequest) {
  const { failWithCode, ok, requestId } = createApiRequestContext(request);
  const incomingPaymentFlowId = readPaymentFlowIdFromHeaders(request.headers);
  const requestPaymentFlowId = resolvePaymentFlowId({
    candidate: incomingPaymentFlowId,
    fallbackSeed: requestId,
  });

  let auth: Awaited<ReturnType<typeof authenticateRequest>> = null;
  try {
    auth = await authenticateRequest(request);
  } catch (error) {
    logError("/api/v1/payments/timeline authenticateRequest", error, {
      requestId,
      paymentFlowId: requestPaymentFlowId,
    });
    return failWithCode(401, "Unauthorized", "AUTH_UNAUTHORIZED", undefined, {
      headers: buildPaymentFlowHeaders("timeline", requestPaymentFlowId),
    });
  }
  if (!auth) {
    return failWithCode(401, "Unauthorized", "AUTH_UNAUTHORIZED", undefined, {
      headers: buildPaymentFlowHeaders("timeline", requestPaymentFlowId),
    });
  }
  const authContext = auth;

  if (!checkRateLimit(`payments:timeline:${authContext.userId}`, 120, 60_000)) {
    return failWithCode(
      429,
      "Too many payment timeline requests",
      "PAYMENTS_TIMELINE_RATE_LIMITED",
      undefined,
      {
        headers: buildPaymentFlowHeaders("timeline", requestPaymentFlowId),
      },
    );
  }

  const searchParams = parseSearchParams(request);
  const orderId = (searchParams.get("orderId") || "").trim();
  const paymentFlowIdQuery = (
    searchParams.get("paymentFlowId") ||
    searchParams.get("flowId") ||
    ""
  ).trim();
  const lookupMode = resolveLookupMode(orderId, paymentFlowIdQuery);
  const paymentFlowId = resolvePaymentFlowId({
    candidate: paymentFlowIdQuery || incomingPaymentFlowId,
    orderId,
    fallbackSeed: requestId,
  });
  const logContext = {
    requestId,
    userId: authContext.userId,
    lookupMode: lookupMode || "missing",
    orderIdQuery: orderId || null,
    paymentFlowIdQuery: paymentFlowIdQuery || null,
    incomingPaymentFlowId: incomingPaymentFlowId || null,
    resolvedFlowId: paymentFlowId,
  };

  if (!orderId && !paymentFlowIdQuery) {
    logInfo("/api/v1/payments/timeline", {
      ...logContext,
      outcome: "invalid_query",
      code: "ORDER_ID_REQUIRED",
    });
    return failWithCode(
      400,
      "orderId or paymentFlowId is required",
      "ORDER_ID_REQUIRED",
      undefined,
      {
        headers: buildTimelineHeaders({
          flowId: paymentFlowId,
          lookupMode,
        }),
      },
    );
  }

  try {
    const admin = createSupabaseAdminClient({
      fallbackAccessToken: authContext.accessToken,
    });
    const payment = orderId
      ? await getPaymentByOrderId(admin, orderId)
      : await getLatestPaymentByFlowId(
          admin,
          authContext.userId,
          paymentFlowIdQuery,
        );

    if (!payment) {
      logInfo("/api/v1/payments/timeline", {
        ...logContext,
        outcome: "payment_not_found",
        code: "PAYMENT_NOT_FOUND",
      });
      return failWithCode(
        404,
        "Payment record not found",
        "PAYMENT_NOT_FOUND",
        undefined,
        {
          headers: buildTimelineHeaders({
            flowId: paymentFlowId,
            lookupMode,
          }),
        },
      );
    }

    if (payment.user_id !== authContext.userId) {
      logInfo("/api/v1/payments/timeline", {
        ...logContext,
        outcome: "payment_user_mismatch",
        code: "PAYMENT_USER_MISMATCH",
        resolvedOrderId: payment.order_id,
      });
      return failWithCode(
        403,
        "Payment does not belong to current user",
        "PAYMENT_USER_MISMATCH",
        undefined,
        {
          headers: buildTimelineHeaders({
            flowId: paymentFlowId,
            lookupMode,
          }),
        },
      );
    }

    let degradedReason: string | null = null;
    const transmissions = await listWebhookTransmissionsByOrder(
      admin,
      payment.order_id,
      authContext.userId,
    ).catch(error => {
      if (!isPermissionDenied(error)) {
        throw error;
      }

      degradedReason = "webhook_transmissions_permission_denied";
      logInfo("/api/v1/payments/timeline", {
        ...logContext,
        outcome: "degraded_webhook_transmissions_unreadable",
        degradedReason,
        resolvedOrderId: payment.order_id,
      });

      return [];
    });
    const events: TimelineEvent[] = [];

    events.push({
      type: "payment_created",
      source: "payment_history",
      timestamp: payment.created_at,
      details: {
        status: "pending",
      },
    });

    if (payment.status === "completed" && payment.completed_at) {
      events.push({
        type: "payment_completed",
        source: "payment_history",
        timestamp: payment.completed_at,
        details: {
          paymentKey: payment.payment_key || null,
        },
      });
    } else if (payment.status === "failed") {
      events.push({
        type: "payment_failed",
        source: "payment_history",
        timestamp: payment.completed_at || payment.created_at,
      });
    } else if (payment.status === "cancelled") {
      events.push({
        type: "payment_cancelled",
        source: "payment_history",
        timestamp: payment.completed_at || payment.created_at,
      });
    }

    transmissions.forEach(transmission => {
      events.push({
        type: "webhook_received",
        source: "webhook_transmissions",
        timestamp: transmission.transmission_time || transmission.created_at,
        details: {
          transmissionId: transmission.transmission_id,
          eventType: transmission.event_type,
          retriedCount: transmission.retried_count,
        },
      });
    });

    const resolvedPaymentFlowId = payment.payment_flow_id || paymentFlowId;
    const sortedEvents = sortByTimestampAsc(events);

    logInfo("/api/v1/payments/timeline", {
      ...logContext,
      outcome: "success",
      resolvedOrderId: payment.order_id,
      paymentFlowId: resolvedPaymentFlowId,
      eventCount: sortedEvents.length,
      webhookEventCount: transmissions.length,
      degradedReason: degradedReason || null,
    });

    return ok(
      {
        orderId: payment.order_id,
        status: payment.status,
        amount: Number(payment.amount),
        beadQuantity: Number(payment.bead_quantity),
        paymentKey: payment.payment_key || null,
        paymentFlowId: resolvedPaymentFlowId,
        events: sortedEvents,
      },
      {
        headers: buildTimelineHeaders({
          flowId: resolvedPaymentFlowId,
          lookupMode,
          degradedReason,
        }),
      },
    );
  } catch (error) {
    logError("/api/v1/payments/timeline", error, {
      ...logContext,
      outcome: "failed",
      code: "PAYMENTS_TIMELINE_FETCH_FAILED",
    });
    return failWithCode(
      500,
      "Failed to fetch payment timeline",
      "PAYMENTS_TIMELINE_FETCH_FAILED",
      undefined,
      {
        headers: buildTimelineHeaders({
          flowId: paymentFlowId,
          lookupMode,
        }),
      },
    );
  }
}
