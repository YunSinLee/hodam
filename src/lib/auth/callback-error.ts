function normalize(message: string | null | undefined): string {
  return (message || "").toLowerCase();
}

export type SignInRecoveryCode =
  | "expired_code"
  | "invalid_request"
  | "timeout"
  | "access_denied"
  | "callback_missing"
  | "callback_failed";

export function formatSessionErrorMessage(errorMessage: string | null) {
  if (!errorMessage) {
    return "로그인 세션을 찾을 수 없습니다.";
  }

  const normalized = normalize(errorMessage);

  if (normalized.includes("code verifier")) {
    return "로그인 검증 정보가 만료되어 세션을 복구하지 못했습니다. 다시 로그인해주세요.";
  }

  if (
    normalized.includes("invalid_grant") ||
    normalized.includes("authorization code") ||
    normalized.includes("already been used") ||
    normalized.includes("expired")
  ) {
    return "로그인 인증 코드가 만료되었거나 이미 사용되었습니다. 로그인 페이지에서 다시 시도해주세요.";
  }

  if (normalized.includes("invalid request")) {
    return "로그인 요청 정보가 유효하지 않습니다. 로그인 페이지에서 다시 시도해주세요.";
  }

  if (normalized.includes("timeout")) {
    return "로그인 응답이 지연되어 세션을 복구하지 못했습니다. 잠시 후 다시 시도해주세요.";
  }

  return `로그인 세션을 찾을 수 없습니다. (${errorMessage})`;
}

export function isTerminalSessionExchangeError(errorMessage: string | null) {
  const normalized = normalize(errorMessage);
  if (!normalized) return false;

  return (
    normalized.includes("code verifier") ||
    normalized.includes("invalid_grant") ||
    normalized.includes("invalid request") ||
    normalized.includes("authorization code") ||
    normalized.includes("expired") ||
    normalized.includes("already been used")
  );
}

export function toSignInRecoveryCode(
  errorMessage: string | null | undefined,
): SignInRecoveryCode {
  const normalized = normalize(errorMessage);
  if (!normalized) {
    return "callback_failed";
  }

  if (normalized.includes("access_denied")) {
    return "access_denied";
  }

  if (
    normalized.includes("code verifier") ||
    normalized.includes("invalid_grant") ||
    normalized.includes("authorization code") ||
    normalized.includes("already been used") ||
    normalized.includes("expired")
  ) {
    return "expired_code";
  }

  if (normalized.includes("invalid request")) {
    return "invalid_request";
  }

  if (normalized.includes("timeout")) {
    return "timeout";
  }

  return "callback_failed";
}
