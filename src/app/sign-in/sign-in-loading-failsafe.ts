export const SIGN_IN_LOADING_FAILSAFE_MS = 25_000;

export function getSignInLoadingFailsafeMessage(
  provider: "kakao" | "google",
): string {
  const providerLabel = provider === "kakao" ? "카카오" : "구글";
  return `${providerLabel} 로그인 처리 시간이 지연되고 있습니다. 네트워크 상태를 확인한 뒤 다시 시도해주세요.`;
}

interface ScheduleSignInLoadingFailsafeParams {
  provider: "kakao" | "google";
  setLoading: (loading: boolean) => void;
  setErrorMessage: (message: string) => void;
  delayMs?: number;
}

export function scheduleSignInLoadingFailsafe({
  provider,
  setLoading,
  setErrorMessage,
  delayMs = SIGN_IN_LOADING_FAILSAFE_MS,
}: ScheduleSignInLoadingFailsafeParams): () => void {
  let active = true;

  const timeoutId = setTimeout(() => {
    if (!active) {
      return;
    }
    setLoading(false);
    setErrorMessage(getSignInLoadingFailsafeMessage(provider));
  }, delayMs);

  return () => {
    active = false;
    clearTimeout(timeoutId);
  };
}
