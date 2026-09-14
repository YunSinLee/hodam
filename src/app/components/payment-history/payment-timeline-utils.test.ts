import { describe, expect, it } from "vitest";

import {
  createTimelineEventKey,
  getTimelineEventDetailText,
  getTimelineEventDotTone,
  getTimelineEventTitle,
  getWebhookRetryTotal,
} from "@/app/components/payment-history/payment-timeline-utils";

describe("payment-timeline-utils", () => {
  it("maps timeline event titles and tones", () => {
    expect(getTimelineEventTitle("payment_created")).toBe("결제 생성");
    expect(getTimelineEventTitle("webhook_received")).toBe("웹훅 수신");
    expect(getTimelineEventDotTone("payment_completed")).toBe("bg-emerald-500");
    expect(getTimelineEventDotTone("payment_failed")).toBe("bg-red-500");
  });

  it("formats event detail texts", () => {
    expect(
      getTimelineEventDetailText({
        type: "payment_completed",
        source: "payment_history",
        timestamp: "2026-04-07T00:00:00.000Z",
        details: { paymentKey: "pk_1" },
      }),
    ).toContain("결제키: pk_1");

    expect(
      getTimelineEventDetailText({
        type: "webhook_received",
        source: "webhook_transmissions",
        timestamp: "2026-04-07T00:00:00.000Z",
        details: {
          eventType: "PAYMENT_STATUS_CHANGED",
          retriedCount: 2,
          transmissionId: "tx_1",
        },
      }),
    ).toContain("전송ID: tx_1");
  });

  it("creates stable keys and sums retry counts", () => {
    expect(
      createTimelineEventKey({
        type: "webhook_received",
        source: "webhook_transmissions",
        timestamp: "2026-04-07T00:00:00.000Z",
        details: { transmissionId: "tx_1" },
      }),
    ).toContain("tx_1");

    expect(
      getWebhookRetryTotal([
        {
          type: "webhook_received",
          source: "webhook_transmissions",
          timestamp: "2026-04-07T00:00:00.000Z",
          details: { retriedCount: 2 },
        },
        {
          type: "webhook_received",
          source: "webhook_transmissions",
          timestamp: "2026-04-07T00:00:01.000Z",
          details: { retriedCount: 1 },
        },
      ]),
    ).toBe(3);
  });
});
