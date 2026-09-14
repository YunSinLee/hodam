import type { ReadonlyURLSearchParams } from "next/navigation";

export interface ParsedPaymentSuccessParams {
  paymentKey: string;
  orderId: string;
  amount: number;
}

const MISSING_PAYMENT_INFO_MESSAGE = "결제 정보가 올바르지 않습니다.";
const INVALID_AMOUNT_MESSAGE = "결제 금액 정보가 올바르지 않습니다.";
const DEFAULT_PAYMENT_ERROR_MESSAGE = "결제 처리 중 오류가 발생했습니다.";
const PENDING_PAYMENT_MESSAGE_KEYWORD = "처리 중";

export function parsePaymentSuccessParams(
  searchParams: URLSearchParams | ReadonlyURLSearchParams,
):
  | { ok: true; value: ParsedPaymentSuccessParams }
  | { ok: false; errorMessage: string } {
  const paymentKey = (searchParams.get("paymentKey") || "").trim();
  const orderId = (searchParams.get("orderId") || "").trim();
  const rawAmount = (searchParams.get("amount") || "").trim();

  if (!paymentKey || !orderId || !rawAmount) {
    return {
      ok: false,
      errorMessage: MISSING_PAYMENT_INFO_MESSAGE,
    };
  }

  const amount = Number.parseInt(rawAmount, 10);
  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      ok: false,
      errorMessage: INVALID_AMOUNT_MESSAGE,
    };
  }

  return {
    ok: true,
    value: {
      paymentKey,
      orderId,
      amount,
    },
  };
}

export function toPaymentProcessingErrorMessage(error: unknown): string {
  if (error instanceof Error && typeof error.message === "string") {
    if (error.message.includes(PENDING_PAYMENT_MESSAGE_KEYWORD)) {
      return error.message;
    }
  }

  return DEFAULT_PAYMENT_ERROR_MESSAGE;
}
