import { ApiError, getApiErrorCode } from "@/lib/client/api/http";

export interface ThreadDetailErrorState {
  message: string;
  shouldRedirectToSignIn: boolean;
}

export function resolveThreadDetailErrorState(
  error: unknown,
): ThreadDetailErrorState {
  if (error instanceof ApiError) {
    const code = getApiErrorCode(error)?.toUpperCase();

    if (code === "AUTH_UNAUTHORIZED") {
      return {
        message: "로그인 세션이 만료되었습니다. 다시 로그인해주세요.",
        shouldRedirectToSignIn: true,
      };
    }

    if (code === "THREAD_NOT_FOUND") {
      return {
        message:
          "해당 동화를 찾을 수 없습니다. 목록에서 다른 동화를 선택해주세요.",
        shouldRedirectToSignIn: false,
      };
    }

    if (code === "THREAD_ID_INVALID") {
      return {
        message: "잘못된 동화 ID입니다.",
        shouldRedirectToSignIn: false,
      };
    }

    if (code === "THREAD_DETAIL_RATE_LIMITED") {
      return {
        message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
        shouldRedirectToSignIn: false,
      };
    }

    if (code === "THREAD_DETAIL_FETCH_FAILED") {
      return {
        message:
          "서버에서 동화 상세를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
        shouldRedirectToSignIn: false,
      };
    }

    if (error.status === 401) {
      return {
        message: "로그인 세션이 만료되었습니다. 다시 로그인해주세요.",
        shouldRedirectToSignIn: true,
      };
    }

    if (error.status === 404) {
      return {
        message:
          "해당 동화를 찾을 수 없습니다. 목록에서 다른 동화를 선택해주세요.",
        shouldRedirectToSignIn: false,
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
        message:
          "서버에서 동화 상세를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
        shouldRedirectToSignIn: false,
      };
    }

    return {
      message: error.message || "동화 상세를 불러오지 못했습니다.",
      shouldRedirectToSignIn: false,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message || "동화 상세를 불러오지 못했습니다.",
      shouldRedirectToSignIn: false,
    };
  }

  return {
    message: "동화 상세를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
    shouldRedirectToSignIn: false,
  };
}

export function resolveThreadDetailErrorMessage(error: unknown): string {
  return resolveThreadDetailErrorState(error).message;
}
