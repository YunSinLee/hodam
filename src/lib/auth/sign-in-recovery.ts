import type { SignInRecoveryCode } from "@/lib/auth/callback-error";

const HINTS: Record<SignInRecoveryCode, string> = {
  expired_code:
    "인증 코드가 만료되었거나 이미 사용되었습니다. 로그인 버튼을 다시 눌러 새로 시도해주세요.",
  invalid_request:
    "OAuth 요청 정보가 유효하지 않습니다. SITE_URL/Redirect URL 설정을 확인해주세요.",
  timeout:
    "로그인 응답이 지연되었습니다. 잠시 후 네트워크 상태를 확인하고 다시 시도해주세요.",
  access_denied:
    "소셜 로그인 권한 동의가 취소되었습니다. 다시 로그인 버튼을 눌러 진행해주세요.",
  callback_missing:
    "로그인 콜백 파라미터가 누락되었습니다. 브라우저에서 다시 로그인해주세요.",
  callback_failed:
    "로그인 콜백 처리에 실패했습니다. 잠시 후 다시 시도해주세요.",
};

const VALID_CODES = new Set<SignInRecoveryCode>(
  Object.keys(HINTS) as SignInRecoveryCode[],
);

const LEGACY_ALIAS: Record<string, SignInRecoveryCode> = {
  invalid_grant: "expired_code",
  code_verifier: "invalid_request",
  callback_timeout: "timeout",
};

export function parseSignInRecoveryCode(
  value: string | null | undefined,
): SignInRecoveryCode | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  const canonical = (LEGACY_ALIAS[normalized] ||
    normalized) as SignInRecoveryCode;
  if (!VALID_CODES.has(canonical)) return null;
  return canonical;
}

export function getSignInRecoveryHint(
  value: string | null | undefined,
): string | null {
  const parsed = parseSignInRecoveryCode(value);
  if (!parsed) return null;
  return HINTS[parsed];
}
