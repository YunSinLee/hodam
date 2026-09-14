import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/client/api/http";
import {
  isAlreadyProcessedPaymentError,
  resolveBeadPaymentFeedback,
  resolveBeadPaymentErrorMessage,
} from "@/lib/ui/bead-payment-error";

describe("isAlreadyProcessedPaymentError", () => {
  it("returns true for known already processed codes", () => {
    expect(
      isAlreadyProcessedPaymentError(
        new ApiError(400, "already done", {
          code: "ALREADY_PROCESSED_PAYMENT",
        }),
      ),
    ).toBe(true);
  });

  it("returns true for matching error messages", () => {
    expect(
      isAlreadyProcessedPaymentError(new Error("이미 처리된 결제입니다.")),
    ).toBe(true);
  });

  it("returns false when not already processed", () => {
    expect(
      isAlreadyProcessedPaymentError(
        new ApiError(400, "failed", {
          code: "PAYMENTS_CONFIRM_FAILED",
        }),
      ),
    ).toBe(false);
  });
});

describe("resolveBeadPaymentErrorMessage", () => {
  it("returns auth message", () => {
    expect(
      resolveBeadPaymentErrorMessage(
        new ApiError(401, "Unauthorized", {
          code: "AUTH_UNAUTHORIZED",
        }),
      ),
    ).toBe("로그인 정보를 찾을 수 없습니다. 다시 로그인해주세요.");
  });

  it("returns pending message for pending code", () => {
    expect(
      resolveBeadPaymentErrorMessage(
        new ApiError(409, "pending", {
          code: "PAYMENT_PENDING",
        }),
      ),
    ).toBe("결제가 아직 처리 중입니다. 잠시 후 다시 확인해주세요.");
  });

  it("returns verification message for mismatch code", () => {
    expect(
      resolveBeadPaymentErrorMessage(
        new ApiError(400, "Amount mismatch", {
          code: "PAYMENT_AMOUNT_MISMATCH",
        }),
      ),
    ).toBe("결제 검증에 실패했습니다. 다시 시도해주세요.");
  });

  it("returns fallback message for unknown errors", () => {
    expect(resolveBeadPaymentErrorMessage(new Error("boom"))).toBe(
      "결제 처리 중 오류가 발생했습니다. 고객센터로 문의해주세요.",
    );
  });
});

describe("resolveBeadPaymentFeedback", () => {
  it("returns goSignIn action for AUTH_UNAUTHORIZED", () => {
    expect(
      resolveBeadPaymentFeedback(
        new ApiError(401, "Unauthorized", {
          code: "AUTH_UNAUTHORIZED",
        }),
      ),
    ).toEqual({
      message: "로그인 정보를 찾을 수 없습니다. 다시 로그인해주세요.",
      action: {
        type: "goSignIn",
        label: "다시 로그인",
      },
    });
  });

  it("returns retry action for non-auth errors", () => {
    expect(
      resolveBeadPaymentFeedback(
        new ApiError(500, "failed", {
          code: "PAYMENTS_CONFIRM_FAILED",
        }),
      ),
    ).toEqual({
      message: "결제 처리 중 오류가 발생했습니다. 고객센터로 문의해주세요.",
      action: {
        type: "retry",
        label: "다시 시도",
      },
    });
  });
});
