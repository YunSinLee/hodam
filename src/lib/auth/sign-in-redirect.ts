import { sanitizePostLoginRedirectPath } from "@/lib/auth/post-login-redirect";

export function buildSignInRedirectPath(
  nextPath: string,
  authError: string = "callback_failed",
): string {
  const safeNextPath = sanitizePostLoginRedirectPath(nextPath) || "/";
  const safeAuthError = authError || "callback_failed";

  return `/sign-in?auth_error=${encodeURIComponent(
    safeAuthError,
  )}&next=${encodeURIComponent(safeNextPath)}`;
}
