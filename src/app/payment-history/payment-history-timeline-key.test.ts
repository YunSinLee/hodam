import { describe, expect, it } from "vitest";

import {
  normalizeTimelineId,
  parseTimelineRequestKey,
  toTimelineRequestKey,
} from "@/app/payment-history/payment-history-timeline-key";

describe("payment-history timeline key helpers", () => {
  it("normalizes ids safely", () => {
    expect(normalizeTimelineId("  order_1  ")).toBe("order_1");
    expect(normalizeTimelineId(null)).toBe("");
    expect(normalizeTimelineId(undefined)).toBe("");
  });

  it("prefers order key over flow key", () => {
    expect(toTimelineRequestKey("order_1", "flow_1")).toBe("order:order_1");
  });

  it("uses flow key when order id is missing", () => {
    expect(toTimelineRequestKey("   ", "flow_1")).toBe("flow:flow_1");
  });

  it("returns null when both ids are empty", () => {
    expect(toTimelineRequestKey("  ", null)).toBeNull();
  });

  it("parses order request key", () => {
    expect(parseTimelineRequestKey("order:order_1")).toEqual({
      orderId: "order_1",
      paymentFlowId: null,
    });
  });

  it("parses flow request key", () => {
    expect(parseTimelineRequestKey("flow:flow_1")).toEqual({
      orderId: null,
      paymentFlowId: "flow_1",
    });
  });

  it("handles malformed request key", () => {
    expect(parseTimelineRequestKey("unknown")).toEqual({
      orderId: null,
      paymentFlowId: null,
    });
  });
});
