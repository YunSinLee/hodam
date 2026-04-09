import { shouldRedirectAfterSignIn } from "@/lib/auth/session-state";

interface ResolveNavBarAuthRedirectParams {
  event: string;
  hasSessionUser: boolean;
  pathname: string | null | undefined;
}

export function resolveNavBarScrollState(scrollY: number): boolean {
  return scrollY > 10;
}

export function resolveNavBarAuthRedirect({
  event,
  hasSessionUser,
  pathname,
}: ResolveNavBarAuthRedirectParams): boolean {
  return (
    event === "SIGNED_IN" &&
    hasSessionUser &&
    shouldRedirectAfterSignIn(pathname)
  );
}

export function shouldLoadNavBarBeadCount(userId: string | undefined): boolean {
  return typeof userId === "string" && userId.trim().length > 0;
}
