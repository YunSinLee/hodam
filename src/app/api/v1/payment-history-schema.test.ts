import { describe, expect, it } from "vitest";

import { PaymentHistoryResponseSchema } from "./schemas";

const payment = {
  id: "payment-1",
  user_id: "user-1",
  order_id: "order-1",
  amount: 5000,
  bead_quantity: 10,
  created_at: "2026-10-07T00:00:00Z",
};

describe("payment history response contract", () => {
  it.each(["pending", "failed", "cancelled"])(
    "accepts SQL nulls for an unfinished %s payment alongside completed payments",
    status => {
      const response = {
        payments: [
          { ...payment, status, payment_key: null, completed_at: null },
          {
            ...payment,
            id: "payment-2",
            status: "completed",
            payment_key: "pay-2",
            completed_at: "2026-10-07T00:01:00Z",
          },
        ],
      };
      expect(PaymentHistoryResponseSchema.parse(response)).toEqual(response);
    },
  );

  it("still rejects malformed amounts and unknown statuses", () => {
    expect(
      PaymentHistoryResponseSchema.safeParse({
        payments: [{ ...payment, status: "unknown", amount: "5000" }],
      }).success,
    ).toBe(false);
  });
});
