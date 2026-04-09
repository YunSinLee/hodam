export function normalizeTimelineId(value?: string | null): string {
  return typeof value === "string" ? value.trim() : "";
}

export function toTimelineRequestKey(
  orderId?: string | null,
  paymentFlowId?: string | null,
): string | null {
  const normalizedOrderId = normalizeTimelineId(orderId);
  if (normalizedOrderId) {
    return `order:${normalizedOrderId}`;
  }

  const normalizedPaymentFlowId = normalizeTimelineId(paymentFlowId);
  if (normalizedPaymentFlowId) {
    return `flow:${normalizedPaymentFlowId}`;
  }

  return null;
}

export function parseTimelineRequestKey(requestKey?: string | null): {
  orderId: string | null;
  paymentFlowId: string | null;
} {
  if (!requestKey) {
    return { orderId: null, paymentFlowId: null };
  }

  if (requestKey.startsWith("order:")) {
    const orderId = requestKey.slice("order:".length).trim();
    return {
      orderId: orderId || null,
      paymentFlowId: null,
    };
  }

  if (requestKey.startsWith("flow:")) {
    const paymentFlowId = requestKey.slice("flow:".length).trim();
    return {
      orderId: null,
      paymentFlowId: paymentFlowId || null,
    };
  }

  return { orderId: null, paymentFlowId: null };
}
