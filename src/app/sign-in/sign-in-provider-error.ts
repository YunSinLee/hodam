export function extractOAuthAttemptId(error: unknown): string | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  if (
    "oauthAttemptId" in error &&
    typeof (error as { oauthAttemptId?: unknown }).oauthAttemptId === "string"
  ) {
    return (error as { oauthAttemptId: string }).oauthAttemptId;
  }

  return null;
}

function resolveErrorDetail(error: unknown): string {
  if (error instanceof Error && error.message) {
    return ` (${error.message})`;
  }

  return "";
}

export function buildSignInProviderErrorMessage(
  provider: "kakao" | "google",
  error: unknown,
): string {
  const providerLabel = provider === "kakao" ? "카카오" : "구글";
  const detail = resolveErrorDetail(error);
  const attemptId = extractOAuthAttemptId(error);
  const attemptIdDetail = attemptId ? ` [시도 ID: ${attemptId}]` : "";

  return `${providerLabel} 로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.${detail}${attemptIdDetail}`;
}
