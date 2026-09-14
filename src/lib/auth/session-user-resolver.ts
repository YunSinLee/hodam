import type { SessionUserInfo } from "@/lib/auth/session-state";

export interface ResolveSessionUserParams {
  currentUser: SessionUserInfo | null | undefined;
  recoverSessionUser: () => Promise<SessionUserInfo | null>;
  onRecoveredUser?: (user: SessionUserInfo) => void;
}

export interface ResolveSessionUserOptions {
  requireEmail?: boolean;
}

function normalizeSessionUser(
  user: SessionUserInfo | null | undefined,
): SessionUserInfo | null {
  if (!user) {
    return null;
  }

  const id = typeof user.id === "string" ? user.id.trim() : "";
  const email = typeof user.email === "string" ? user.email.trim() : "";

  return {
    profileUrl: user.profileUrl || "",
    id: id || undefined,
    email: email || undefined,
  };
}

function isUsableSessionUser(
  user: SessionUserInfo | null,
  requireEmail: boolean,
): user is SessionUserInfo {
  if (!user?.id) {
    return false;
  }

  if (requireEmail && !user.email) {
    return false;
  }

  return true;
}

export async function resolveSessionUser(
  params: ResolveSessionUserParams,
  options: ResolveSessionUserOptions = {},
): Promise<SessionUserInfo | null> {
  const requireEmail = Boolean(options.requireEmail);
  const currentUser = normalizeSessionUser(params.currentUser);
  if (isUsableSessionUser(currentUser, requireEmail)) {
    return currentUser;
  }

  const recoveredUser = normalizeSessionUser(await params.recoverSessionUser());
  if (!isUsableSessionUser(recoveredUser, requireEmail)) {
    return null;
  }

  params.onRecoveredUser?.(recoveredUser);
  return recoveredUser;
}
