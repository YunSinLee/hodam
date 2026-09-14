import type { SessionUserInfo } from "@/lib/auth/session-state";
import {
  resolveSessionUser,
  type ResolveSessionUserOptions,
  type ResolveSessionUserParams,
} from "@/lib/auth/session-user-resolver";

interface ResolveMyStorySessionUserParams
  extends Omit<ResolveSessionUserParams, "currentUser"> {
  currentUser: SessionUserInfo;
}

type ResolveMyStorySessionUserOptions = ResolveSessionUserOptions;

export async function resolveMyStorySessionUser(
  params: ResolveMyStorySessionUserParams,
  options: ResolveMyStorySessionUserOptions = {},
): Promise<SessionUserInfo | null> {
  return resolveSessionUser(params, options);
}
