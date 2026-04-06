import { ApiError } from "@/lib/client/api/http";

export interface ProtectedPageErrorState {
  message: string;
  shouldRedirectToSignIn: boolean;
}

export function resolveProtectedPageErrorState(
  error: unknown,
  fallbackMessage: string,
): ProtectedPageErrorState {
  if (error instanceof ApiError) {
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
