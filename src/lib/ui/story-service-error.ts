import { ApiError, getApiErrorCode } from "@/lib/client/api/http";

export interface StoryServiceFeedbackAction {
  type: "goSignIn" | "goBead";
  label: string;
}

export interface StoryServiceFeedback {
  message: string;
  action: StoryServiceFeedbackAction | null;
}

export function resolveStoryServiceError(error: unknown): string {
  if (error instanceof ApiError) {
    const code = getApiErrorCode(error)?.toUpperCase();

    if (code === "AUTH_UNAUTHORIZED") return "로그인이 필요합니다.";
    if (code === "BEADS_INSUFFICIENT") return "곶감이 부족합니다.";
    if (code === "THREAD_NOT_FOUND")
      return "동화를 찾을 수 없습니다. 다시 시도해주세요.";
    if (
      code === "DAILY_AI_COST_LIMIT_EXCEEDED" ||
      code === "STORY_DAILY_COST_LIMIT_EXCEEDED"
    ) {
      return "오늘 생성 한도에 도달했습니다. 내일 다시 시도해주세요.";
    }
    if (
      code === "STORY_START_RATE_LIMITED" ||
      code === "STORY_CONTINUE_RATE_LIMITED" ||
      code === "STORY_TRANSLATE_RATE_LIMITED"
    ) {
      return "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.";
    }
    if (
      code === "STORY_START_BLOCKED_TOPIC" ||
      code === "STORY_CONTINUE_BLOCKED_TOPIC"
    ) {
      return "안전하지 않은 주제는 사용할 수 없습니다.";
    }
    if (
      code === "STORY_START_BLOCKED_OUTPUT" ||
      code === "STORY_CONTINUE_BLOCKED_OUTPUT" ||
      code === "STORY_TRANSLATE_BLOCKED_OUTPUT"
    ) {
      return "생성된 내용이 안전 정책에 의해 차단되었습니다. 다른 입력으로 다시 시도해주세요.";
    }

    if (error.status === 401) return "로그인이 필요합니다.";
    if (error.status === 402) return "곶감이 부족합니다.";
    if (error.status === 429)
      return "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.";
    return error.message;
  }

  if (error instanceof Error) return error.message;
  return "요청 처리 중 오류가 발생했습니다.";
}

export function resolveStoryServiceFeedback(
  error: unknown,
): StoryServiceFeedback {
  const message = resolveStoryServiceError(error);
  const code = getApiErrorCode(error)?.toUpperCase();

  if (
    code === "AUTH_UNAUTHORIZED" ||
    (error instanceof ApiError && error.status === 401)
  ) {
    return {
      message,
      action: {
        type: "goSignIn",
        label: "로그인하기",
      },
    };
  }

  if (
    code === "BEADS_INSUFFICIENT" ||
    (error instanceof ApiError && error.status === 402)
  ) {
    return {
      message,
      action: {
        type: "goBead",
        label: "곶감 충전",
      },
    };
  }

  return {
    message,
    action: null,
  };
}
