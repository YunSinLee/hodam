import { describe, expect, it } from "vitest";

import {
  parsePaymentSuccessParams,
  toPaymentProcessingErrorMessage,
} from "@/lib/ui/payment-success";

describe("payment-success helpers", () => {
  it("parses valid query params", () => {
    const params = new URLSearchParams({
      paymentKey: "pay_1",
      orderId: "order_1",
      amount: "5000",
    });

    expect(parsePaymentSuccessParams(params)).toEqual({
      ok: true,
      value: {
        paymentKey: "pay_1",
        orderId: "order_1",
        amount: 5000,
      },
    });
  });

  it("returns missing-info message when fields are absent", () => {
    const params = new URLSearchParams({
      paymentKey: "pay_1",
    });

    expect(parsePaymentSuccessParams(params)).toEqual({
      ok: false,
      errorMessage: "결제 정보가 올바르지 않습니다.",
    });
  });

  it("returns invalid-amount message for malformed amount", () => {
    const params = new URLSearchParams({
      paymentKey: "pay_1",
      orderId: "order_1",
      amount: "-1",
    });

    expect(parsePaymentSuccessParams(params)).toEqual({
      ok: false,
      errorMessage: "결제 금액 정보가 올바르지 않습니다.",
    });
  });

  it("keeps pending-payment messages as-is", () => {
    expect(
      toPaymentProcessingErrorMessage(
        new Error("결제가 아직 처리 중입니다. 잠시 후 다시 확인해주세요."),
      ),
    ).toBe("결제가 아직 처리 중입니다. 잠시 후 다시 확인해주세요.");
  });

  it("normalizes unknown payment errors", () => {
    expect(toPaymentProcessingErrorMessage(new Error("network fail"))).toBe(
      "결제 처리 중 오류가 발생했습니다.",
    );
    expect(toPaymentProcessingErrorMessage("bad")).toBe(
      "결제 처리 중 오류가 발생했습니다.",
    );
  });
});
