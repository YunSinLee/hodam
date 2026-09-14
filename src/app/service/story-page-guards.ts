import { buildSignInRedirectPath } from "@/lib/auth/sign-in-redirect";
import type { StoryServiceFeedbackAction } from "@/lib/ui/story-service-error";

export interface StoryPageGuardFailure {
  ok: false;
  message: string;
  action?: StoryServiceFeedbackAction;
}

export interface StoryPageGuardSuccess {
  ok: true;
}

export type StoryPageGuardResult =
  | StoryPageGuardFailure
  | StoryPageGuardSuccess;

export function guardStartStoryInput(
  userId: string | undefined,
  keywordsPayload: string | null,
): StoryPageGuardResult {
  if (!userId) {
    return {
      ok: false,
      message: "로그인이 필요합니다.",
      action: {
        type: "goSignIn",
        label: "로그인하기",
      },
    };
  }

  if (!keywordsPayload) {
    return {
      ok: false,
      message: "키워드를 1개 이상 입력해주세요.",
    };
  }

  return { ok: true };
}

export function guardContinueStoryInput(
  threadId: number | null,
  selection: string,
): StoryPageGuardResult {
  if (!threadId) {
    return {
      ok: false,
      message: "동화를 먼저 시작해주세요.",
    };
  }

  if (!selection || !selection.trim()) {
    return {
      ok: false,
      message: "선택지가 올바르지 않습니다.",
    };
  }

  return { ok: true };
}

export function getStoryFeedbackActionTarget(
  action: StoryServiceFeedbackAction,
): string {
  if (action.type === "goSignIn") {
    return buildSignInRedirectPath("/service");
  }

  return "/bead";
}
