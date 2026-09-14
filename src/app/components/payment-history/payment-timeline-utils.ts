import type { PaymentTimelinePanelState } from "@/app/payment-history/payment-history-contract";

type PaymentTimelineEvent = PaymentTimelinePanelState["events"][number];

export function getTimelineEventTitle(type: PaymentTimelineEvent["type"]) {
  switch (type) {
    case "payment_created":
      return "결제 생성";
    case "payment_completed":
      return "결제 완료";
    case "payment_failed":
      return "결제 실패";
    case "payment_cancelled":
      return "결제 취소";
    case "webhook_received":
      return "웹훅 수신";
    default:
      return type;
  }
}

export function getTimelineEventDotTone(type: PaymentTimelineEvent["type"]) {
  switch (type) {
    case "payment_completed":
      return "bg-emerald-500";
    case "payment_failed":
      return "bg-red-500";
    case "payment_cancelled":
      return "bg-zinc-400";
    case "webhook_received":
      return "bg-blue-500";
    case "payment_created":
    default:
      return "bg-violet-500";
  }
}

export function getTimelineEventDetailText(event: PaymentTimelineEvent) {
  const details = event.details || {};

  if (event.type === "payment_completed") {
    const paymentKey =
      typeof details.paymentKey === "string" ? details.paymentKey : null;
    if (paymentKey) {
      return `결제키: ${paymentKey}`;
    }
  }

  if (event.type === "webhook_received") {
    const eventType =
      typeof details.eventType === "string" ? details.eventType : null;
    const retriedCount =
      typeof details.retriedCount === "number" ? details.retriedCount : null;
    const transmissionId =
      typeof details.transmissionId === "string"
        ? details.transmissionId
        : null;

    const parts: string[] = [];
    if (eventType) parts.push(`이벤트: ${eventType}`);
    if (typeof retriedCount === "number") {
      parts.push(`재시도: ${retriedCount}회`);
    }
    if (transmissionId) parts.push(`전송ID: ${transmissionId}`);
    return parts.length > 0 ? parts.join(" · ") : null;
  }

  return null;
}

export function createTimelineEventKey(event: PaymentTimelineEvent) {
  const details = event.details || {};
  const transmissionId =
    typeof details.transmissionId === "string" ? details.transmissionId : null;
  const paymentKey =
    typeof details.paymentKey === "string" ? details.paymentKey : null;
  return `${event.source}:${event.type}:${event.timestamp}:${
    transmissionId || paymentKey || "na"
  }`;
}

export function getWebhookRetryTotal(events: PaymentTimelineEvent[]) {
  return events.reduce((total, event) => {
    const retriedCount = event.details?.retriedCount;
    if (typeof retriedCount !== "number" || Number.isNaN(retriedCount)) {
      return total;
    }
    return total + Math.max(0, Math.floor(retriedCount));
  }, 0);
}
