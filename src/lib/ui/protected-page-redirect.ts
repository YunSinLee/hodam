import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

import { buildSignInRedirectPath } from "@/lib/auth/sign-in-redirect";

export const PROTECTED_PAGE_SIGN_IN_REDIRECT_DELAY_MS = 800;

interface ScheduleProtectedPageSignInRedirectParams {
  router: Pick<AppRouterInstance, "replace">;
  returnPath: string;
  delayMs?: number;
}

export function scheduleProtectedPageSignInRedirect({
  router,
  returnPath,
  delayMs = PROTECTED_PAGE_SIGN_IN_REDIRECT_DELAY_MS,
}: ScheduleProtectedPageSignInRedirectParams): () => void {
  const redirectPath = buildSignInRedirectPath(returnPath);
  const timeoutId = setTimeout(() => {
    router.replace(redirectPath);
  }, delayMs);

  return () => {
    clearTimeout(timeoutId);
  };
}
