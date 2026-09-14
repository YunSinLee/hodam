import { ApiError, getApiErrorCode } from "@/lib/client/api/http";

export interface ProtectedPageErrorState {
  message: string;
  shouldRedirectToSignIn: boolean;
}

export interface ProtectedPageFeedbackAction {
  type: "goSignIn" | "retry";
  label: string;
}

export function resolveProtectedPageErrorState(
  error: unknown,
  fallbackMessage: string,
): ProtectedPageErrorState {
  if (error instanceof ApiError) {
    const code = getApiErrorCode(error)?.toUpperCase() || "";

    if (code === "AUTH_UNAUTHORIZED") {
      return {
        message: "로그인 세션이 만료되었습니다. 다시 로그인해주세요.",
        shouldRedirectToSignIn: true,
      };
    }

    if (code.endsWith("_RATE_LIMITED")) {
      return {
        message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
        shouldRedirectToSignIn: false,
      };
    }

    if (code.endsWith("_FETCH_FAILED")) {
      return {
        message: fallbackMessage,
        shouldRedirectToSignIn: false,
      };
    }

    if (error.status === 401) {
      return {
        message: "로그인 세션이 만료되었습니다. 다시 로그인해주세요.",
        shouldRedirectToSignIn: true,
      };
    }

    if (error.status === 429) {
      return {
        message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
        shouldRedirectToSignIn: false,
      };
    }

    if (error.status >= 500) {
      return {
        message: fallbackMessage,
        shouldRedirectToSignIn: false,
      };
    }

    return {
      message: error.message || fallbackMessage,
      shouldRedirectToSignIn: false,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message || fallbackMessage,
      shouldRedirectToSignIn: false,
    };
  }

  return {
    message: fallbackMessage,
    shouldRedirectToSignIn: false,
  };
}

export function getProtectedPageFeedbackAction(
  errorState: ProtectedPageErrorState,
): ProtectedPageFeedbackAction {
  if (errorState.shouldRedirectToSignIn) {
    return {
      type: "goSignIn",
      label: "다시 로그인",
    };
  }

  return {
    type: "retry",
    label: "다시 시도",
  };
}
