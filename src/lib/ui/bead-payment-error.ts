import { getApiErrorCode } from "@/lib/client/api/http";

const ALREADY_PROCESSED_PAYMENT_CODES = new Set([
  "ALREADY_PROCESSED_PAYMENT",
  "ALREADY_COMPLETED_PAYMENT",
  "ALREADY_DONE_PAYMENT",
]);

export interface BeadPaymentFeedbackAction {
  type: "goSignIn" | "retry";
  label: string;
}

export interface BeadPaymentFeedback {
  message: string;
  action: BeadPaymentFeedbackAction | null;
}

function normalizeErrorCode(error: unknown): string | null {
  const code = getApiErrorCode(error);
  if (!code) return null;
  return code.trim().toUpperCase();
}

export function isAlreadyProcessedPaymentError(error: unknown): boolean {
  const normalizedCode = normalizeErrorCode(error);
  if (normalizedCode && ALREADY_PROCESSED_PAYMENT_CODES.has(normalizedCode)) {
    return true;
  }

  return (
    error instanceof Error &&
    Boolean(error.message) &&
    error.message.includes("이미 처리된")
  );
}

export function resolveBeadPaymentErrorMessage(error: unknown): string {
  const code = normalizeErrorCode(error);

  if (code === "AUTH_UNAUTHORIZED") {
    return "로그인 정보를 찾을 수 없습니다. 다시 로그인해주세요.";
  }

  if (
    code === "PAYMENTS_CONFIRM_RATE_LIMITED" ||
    code === "PAYMENTS_STATUS_RATE_LIMITED"
  ) {
    return "결제 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.";
  }

  if (code === "PAYMENT_PENDING") {
    return "결제가 아직 처리 중입니다. 잠시 후 다시 확인해주세요.";
  }

  if (code === "PAYMENT_CANCELLED") {
    return "결제가 취소되었습니다.";
  }

  if (code === "PAYMENTS_PROVIDER_TEMP_FAILURE") {
    return "결제사 응답이 지연되고 있습니다. 잠시 후 다시 확인해주세요.";
  }

  if (
    code === "PAYMENT_NOT_FOUND" ||
    code === "PAYMENT_USER_MISMATCH" ||
    code === "PAYMENT_AMOUNT_MISMATCH" ||
    code === "PAYMENT_STATE_CONFLICT"
  ) {
    return "결제 검증에 실패했습니다. 다시 시도해주세요.";
  }

  if (
    error instanceof Error &&
    error.message &&
    (error.message.includes("처리 중") || error.message.includes("로그인"))
  ) {
    return error.message;
  }

  return "결제 처리 중 오류가 발생했습니다. 고객센터로 문의해주세요.";
}

export function resolveBeadPaymentFeedback(
  error: unknown,
): BeadPaymentFeedback {
  const message = resolveBeadPaymentErrorMessage(error);
  const code = normalizeErrorCode(error);

  if (code === "AUTH_UNAUTHORIZED") {
    return {
      message,
      action: {
        type: "goSignIn",
        label: "다시 로그인",
      },
    };
  }

  return {
    message,
    action: {
      type: "retry",
      label: "다시 시도",
    },
  };
}
