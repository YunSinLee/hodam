export type NavMobileAuthMode = "loading" | "authenticated" | "guest";

export function resolveNavMobileAuthMode(params: {
  hasHydrated: boolean;
  userId: string | undefined;
}): NavMobileAuthMode {
  if (!params.hasHydrated) {
    return "loading";
  }

  if (typeof params.userId === "string" && params.userId.trim().length > 0) {
    return "authenticated";
  }

  return "guest";
}
