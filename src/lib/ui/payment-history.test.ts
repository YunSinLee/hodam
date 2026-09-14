import { describe, expect, it } from "vitest";

import type { PaymentHistory } from "@/lib/client/api/payment";
import {
  filterPaymentHistory,
  getCompletedPaymentTotals,
  getPaymentStatusColor,
  getPaymentStatusText,
  parsePaymentHistoryTimelineQuery,
} from "@/lib/ui/payment-history";

const PAYMENTS: PaymentHistory[] = [
  {
    id: "1",
    user_id: "u1",
    order_id: "o1",
    payment_key: "k1",
    amount: 1000,
    bead_quantity: 10,
    status: "completed",
    created_at: "2026-01-01T00:00:00.000Z",
    completed_at: "2026-01-01T00:01:00.000Z",
  },
  {
    id: "2",
    user_id: "u1",
    order_id: "o2",
    amount: 2000,
    bead_quantity: 20,
    status: "pending",
    created_at: "2026-01-02T00:00:00.000Z",
  },
];

describe("payment-history ui helpers", () => {
  it("maps status text", () => {
    expect(getPaymentStatusText("completed")).toBe("완료");
    expect(getPaymentStatusText("pending")).toBe("대기중");
    expect(getPaymentStatusText("unknown")).toBe("unknown");
  });

  it("maps status color", () => {
    expect(getPaymentStatusColor("failed")).toBe("bg-red-100 text-red-700");
    expect(getPaymentStatusColor("cancelled")).toBe(
      "bg-gray-100 text-gray-700",
    );
  });

  it("filters by selected status", () => {
    expect(filterPaymentHistory(PAYMENTS, "all")).toHaveLength(2);
    expect(filterPaymentHistory(PAYMENTS, "completed")).toHaveLength(1);
    expect(filterPaymentHistory(PAYMENTS, "pending")).toHaveLength(1);
  });

  it("calculates completed totals", () => {
    expect(getCompletedPaymentTotals(PAYMENTS)).toEqual({
      totalAmount: 1000,
      totalBeads: 10,
    });
  });

  it("parses payment-history deep link query", () => {
    const params = new URLSearchParams({
      orderId: "ORDER_1",
      flowId: "order:ORDER_1",
    });

    expect(parsePaymentHistoryTimelineQuery(params)).toEqual({
      orderId: "ORDER_1",
      paymentFlowId: "order:ORDER_1",
    });
  });

  it("returns null when deep link orderId is missing", () => {
    const params = new URLSearchParams({
      flowId: "order:ORDER_1",
    });

    expect(parsePaymentHistoryTimelineQuery(params)).toEqual({
      orderId: undefined,
      paymentFlowId: "order:ORDER_1",
    });
  });

  it("supports paymentFlowId query alias", () => {
    const params = new URLSearchParams({
      paymentFlowId: "order:ORDER_2",
    });

    expect(parsePaymentHistoryTimelineQuery(params)).toEqual({
      orderId: undefined,
      paymentFlowId: "order:ORDER_2",
    });
  });

  it("returns null when neither orderId nor flowId exists", () => {
    const params = new URLSearchParams({});

    expect(parsePaymentHistoryTimelineQuery(params)).toBeNull();
  });
});
