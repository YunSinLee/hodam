import type { SessionUserInfo } from "@/lib/auth/session-state";
import {
  resolveSessionUser,
  type ResolveSessionUserOptions,
  type ResolveSessionUserParams,
} from "@/lib/auth/session-user-resolver";

interface ResolveBeadSessionUserParams
  extends Omit<ResolveSessionUserParams, "currentUser"> {
  currentUser: SessionUserInfo;
}

type ResolveBeadSessionUserOptions = ResolveSessionUserOptions;

export async function resolveBeadSessionUser(
  params: ResolveBeadSessionUserParams,
  options: ResolveBeadSessionUserOptions = {},
): Promise<SessionUserInfo | null> {
  return resolveSessionUser(params, options);
}
