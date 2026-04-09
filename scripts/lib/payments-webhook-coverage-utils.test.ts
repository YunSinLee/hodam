import { describe, expect, it } from "vitest";

import {
  isWithinLookback,
  parsePositiveInt,
  summarizeCoverageRows,
  toRetryTotal,
} from "./payments-webhook-coverage-utils.mjs";

describe("payments-webhook-coverage-utils", () => {
  it("parses positive integer values with fallback", () => {
    expect(parsePositiveInt("10", 3)).toBe(10);
    expect(parsePositiveInt("0", 3)).toBe(3);
    expect(parsePositiveInt("bad", 3)).toBe(3);
  });

  it("evaluates lookback window using provided now timestamp", () => {
    const nowMs = Date.parse("2026-04-07T12:00:00.000Z");
    expect(
      isWithinLookback("2026-04-07T11:30:00.000Z", 60, nowMs),
    ).toBe(true);
    expect(
      isWithinLookback("2026-04-07T10:30:00.000Z", 60, nowMs),
    ).toBe(false);
  });

  it("sums retry counts from webhook transmission rows safely", () => {
    expect(
      toRetryTotal([
        { retried_count: 2 },
        { retried_count: "1" },
        { retried_count: -3 },
        { retried_count: "bad" },
      ]),
    ).toBe(3);
  });

  it("summarizes coverage rows and detects missing webhook orders", () => {
    const summary = summarizeCoverageRows([
      {
        orderId: "HODAM_ORDER_1",
        webhookEvents: 1,
        retryTotal: 0,
      },
      {
        orderId: "HODAM_ORDER_2",
        webhookEvents: 0,
        retryTotal: 2,
      },
      {
        orderId: "HODAM_ORDER_3",
        webhookEvents: 0,
        retryTotal: 0,
      },
    ]);

    expect(summary.totalWebhookEvents).toBe(1);
    expect(summary.totalRetryCount).toBe(2);
    expect(summary.missingOrders).toEqual(["HODAM_ORDER_2", "HODAM_ORDER_3"]);
  });
});
