import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

export const AUTH_CALLBACK_AUTO_RECOVERY_DELAY_MS = 5000;

export function getAuthCallbackAutoRecoveryNotice(delayMs: number): string {
  const seconds = Math.max(1, Math.ceil(delayMs / 1000));
  return `응답 지연으로 ${seconds}초 후 로그인 페이지로 이동합니다.`;
}

interface ScheduleAuthCallbackRecoveryRedirectParams {
  router: Pick<AppRouterInstance, "replace">;
  recoveryCode: string;
  delayMs?: number;
}

export function scheduleAuthCallbackRecoveryRedirect({
  router,
  recoveryCode,
  delayMs = AUTH_CALLBACK_AUTO_RECOVERY_DELAY_MS,
}: ScheduleAuthCallbackRecoveryRedirectParams): () => void {
  const encodedRecoveryCode = encodeURIComponent(recoveryCode);
  const timeoutId = setTimeout(() => {
    router.replace(`/sign-in?auth_error=${encodedRecoveryCode}`);
  }, delayMs);

  return () => {
    clearTimeout(timeoutId);
  };
}
