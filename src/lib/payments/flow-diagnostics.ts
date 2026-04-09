export const PAYMENT_FLOW_HEADER = "x-hodam-payment-flow-id";
export const PAYMENT_STAGE_HEADER = "x-hodam-payment-stage";

const FLOW_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

function normalize(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!FLOW_ID_PATTERN.test(trimmed)) return null;
  return trimmed;
}

export function readPaymentFlowIdFromHeaders(
  headers: Pick<Headers, "get">,
): string | null {
  return normalize(headers.get(PAYMENT_FLOW_HEADER));
}

function toOrderScopedFlowId(orderId: string): string {
  const normalizedOrderId = orderId
    .trim()
    .replace(/[^A-Za-z0-9._:-]/g, "_")
    .slice(0, 108);
  return `order:${normalizedOrderId}`;
}

export function resolvePaymentFlowId(params: {
  orderId?: string | null;
  candidate?: string | null;
  fallbackSeed?: string | null;
}): string {
  const candidate = normalize(params.candidate);
  if (candidate) {
    return candidate;
  }

  const orderId =
    typeof params.orderId === "string" ? params.orderId.trim() : "";
  if (orderId) {
    return toOrderScopedFlowId(orderId);
  }

  const fallbackSeed =
    typeof params.fallbackSeed === "string"
      ? params.fallbackSeed.trim()
      : "unknown";
  const normalizedFallbackSeed = fallbackSeed
    .replace(/[^A-Za-z0-9._:-]/g, "_")
    .slice(0, 112);
  return `req:${normalizedFallbackSeed || "unknown"}`;
}

export function buildPaymentFlowHeaders(
  stage: string,
  flowId: string,
): Headers {
  return new Headers({
    [PAYMENT_FLOW_HEADER]: resolvePaymentFlowId({
      candidate: flowId,
      fallbackSeed: "missing",
    }),
    [PAYMENT_STAGE_HEADER]: stage,
  });
}
