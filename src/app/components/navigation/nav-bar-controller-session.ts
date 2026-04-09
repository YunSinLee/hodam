import { toSessionUserInfo } from "@/lib/auth/session-state";
import type { SessionUserInfo } from "@/lib/auth/session-state";

import type { Session } from "@supabase/supabase-js";

export interface ResolvedNavBarSessionState {
  userInfo: SessionUserInfo | null;
  shouldResetBead: boolean;
}

export function resolveNavBarSessionState(
  session: Session | null,
): ResolvedNavBarSessionState {
  const userInfo = toSessionUserInfo(session);
  if (!userInfo) {
    return {
      userInfo: null,
      shouldResetBead: true,
    };
  }

  return {
    userInfo,
    shouldResetBead: false,
  };
}
