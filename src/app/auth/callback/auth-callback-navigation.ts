import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

const AUTH_CALLBACK_PATH = "/auth/callback";
const DEFAULT_FALLBACK_DELAY_MS = 2500;

interface RedirectLocation {
  pathname: string;
  search: string;
  assign: (url: string) => void;
}

interface ScheduleAuthCallbackRedirectParams {
  router: AppRouterInstance;
  targetPath: string;
  fallbackDelayMs?: number;
  location?: RedirectLocation;
}

export function scheduleAuthCallbackRedirect({
  router,
  targetPath,
  fallbackDelayMs = DEFAULT_FALLBACK_DELAY_MS,
  location = window.location,
}: ScheduleAuthCallbackRedirectParams) {
  router.replace(targetPath);

  const timeoutId = setTimeout(() => {
    const activePath = `${location.pathname}${location.search}`;
    if (activePath.startsWith(AUTH_CALLBACK_PATH)) {
      location.assign(targetPath);
    }
  }, fallbackDelayMs);

  return () => {
    clearTimeout(timeoutId);
  };
}
