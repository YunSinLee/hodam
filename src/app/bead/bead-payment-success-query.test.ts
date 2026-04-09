import { describe, expect, it } from "vitest";

import { parseBeadPaymentSuccessQuery } from "@/app/bead/bead-payment-success-query";

function createParams(input: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  Object.entries(input).forEach(([key, value]) => {
    if (typeof value === "string") {
      params.set(key, value);
    }
  });
  return params;
}

describe("parseBeadPaymentSuccessQuery", () => {
  it("returns null query without error when payment keys are missing", () => {
    const result = parseBeadPaymentSuccessQuery(createParams({}));

    expect(result).toEqual({
      query: null,
      errorMessage: null,
    });
  });

  it("returns normalized payment query when required parameters exist", () => {
    const result = parseBeadPaymentSuccessQuery(
      createParams({
        paymentKey: "pay_1",
        orderId: "order_1",
        amount: "2500",
        flowId: " flow_1 ",
      }),
    );

    expect(result).toEqual({
      query: {
        paymentKey: "pay_1",
        orderId: "order_1",
        amount: 2500,
        paymentFlowId: "flow_1",
      },
      errorMessage: null,
    });
  });

  it("returns validation error when amount is invalid", () => {
    const result = parseBeadPaymentSuccessQuery(
      createParams({
        paymentKey: "pay_1",
        orderId: "order_1",
        amount: "NaN",
      }),
    );

    expect(result).toEqual({
      query: null,
      errorMessage: "결제 파라미터가 올바르지 않습니다.",
    });
  });

  it("returns validation error when amount is not positive", () => {
    const result = parseBeadPaymentSuccessQuery(
      createParams({
        paymentKey: "pay_1",
        orderId: "order_1",
        amount: "0",
      }),
    );

    expect(result).toEqual({
      query: null,
      errorMessage: "결제 파라미터가 올바르지 않습니다.",
    });
  });
});
