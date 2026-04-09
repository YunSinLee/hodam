import type { SessionUserInfo } from "@/lib/auth/session-state";

interface ResolveStoryPageInitializationParams {
  currentUserId: string | undefined;
  recoveredUserInfo: SessionUserInfo | null;
}

type StoryPageInitializationMode = "ready";

export interface StoryPageInitializationResult {
  mode: StoryPageInitializationMode;
  userId: string | undefined;
  shouldSetRecoveredUserInfo: boolean;
  recoveredUserInfo: SessionUserInfo | null;
}

export function resolveStoryPageInitialization(
  params: ResolveStoryPageInitializationParams,
): StoryPageInitializationResult {
  if (params.currentUserId) {
    return {
      mode: "ready",
      userId: params.currentUserId,
      shouldSetRecoveredUserInfo: false,
      recoveredUserInfo: null,
    };
  }

  if (params.recoveredUserInfo?.id) {
    return {
      mode: "ready",
      userId: params.recoveredUserInfo.id,
      shouldSetRecoveredUserInfo: true,
      recoveredUserInfo: params.recoveredUserInfo,
    };
  }

  return {
    mode: "ready",
    userId: undefined,
    shouldSetRecoveredUserInfo: false,
    recoveredUserInfo: null,
  };
}
