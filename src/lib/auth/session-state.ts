import { Session } from "@supabase/supabase-js";

export interface SessionUserInfo {
  profileUrl: string;
  id: string | undefined;
  email: string | undefined;
}

export function toSessionUserInfo(
  session: Pick<Session, "user"> | null | undefined,
): SessionUserInfo | null {
  const user = session?.user;
  if (!user) return null;

  return {
    profileUrl: user.user_metadata?.avatar_url || "",
    id: user.id,
    email: user.email,
  };
}

export function shouldRedirectAfterSignIn(pathname: string | null | undefined) {
  return pathname === "/sign-in" || pathname === "/auth/callback";
}
