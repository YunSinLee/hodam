import type { ProfilePageFeedback } from "@/app/profile/profile-page-contract";
import type { SessionUserInfo } from "@/lib/auth/session-state";

export type ProfilePageInitMode = "existing" | "recovered" | "unauthenticated";

export interface ProfilePageInitializationResult {
  mode: ProfilePageInitMode;
  userId: string | null;
  recoveredUserInfo: SessionUserInfo | null;
  shouldSetRecoveredUserInfo: boolean;
}

function normalizeUserId(value: string | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function resolveProfilePageInitialization(params: {
  currentUserId?: string;
  recoveredUserInfo?: SessionUserInfo | null;
}): ProfilePageInitializationResult {
  const currentUserId = normalizeUserId(params.currentUserId);
  if (currentUserId) {
    return {
      mode: "existing",
      userId: currentUserId,
      recoveredUserInfo: null,
      shouldSetRecoveredUserInfo: false,
    };
  }

  const recoveredUserInfo = params.recoveredUserInfo || null;
  const recoveredUserId = normalizeUserId(recoveredUserInfo?.id);
  if (recoveredUserId && recoveredUserInfo) {
    return {
      mode: "recovered",
      userId: recoveredUserId,
      recoveredUserInfo,
      shouldSetRecoveredUserInfo: true,
    };
  }

  return {
    mode: "unauthenticated",
    userId: null,
    recoveredUserInfo: null,
    shouldSetRecoveredUserInfo: false,
  };
}

export function createProfileSignInRequiredFeedback(): ProfilePageFeedback {
  return {
    type: "error",
    message: "로그인이 필요합니다. 다시 로그인해주세요.",
    actionType: "goSignIn",
    actionLabel: "다시 로그인",
  };
}
