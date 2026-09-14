import { ApiError } from "@/lib/client/api/http";

const PROFILE_IMAGE_ERROR_MESSAGES: Record<string, string> = {
  PROFILE_IMAGE_REQUIRED: "이미지 파일을 선택해주세요.",
  PROFILE_IMAGE_CONTENT_TYPE_INVALID: "이미지 파일만 업로드 가능합니다.",
  PROFILE_IMAGE_EMPTY: "빈 파일은 업로드할 수 없습니다.",
  PROFILE_IMAGE_SIZE_EXCEEDED: "파일 크기는 5MB 이하여야 합니다.",
  PROFILE_IMAGE_UPLOAD_RATE_LIMITED:
    "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
  PROFILE_IMAGE_DELETE_RATE_LIMITED:
    "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
  PROFILE_IMAGE_UPLOAD_FAILED:
    "이미지 업로드에 실패했습니다. 잠시 후 다시 시도해주세요.",
  PROFILE_IMAGE_DELETE_FAILED:
    "이미지 삭제에 실패했습니다. 잠시 후 다시 시도해주세요.",
};

export function resolveProfileImageErrorMessage(
  error: unknown,
  fallbackMessage: string,
): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "로그인 세션이 만료되었습니다. 다시 로그인해주세요.";
    }

    if (error.code && PROFILE_IMAGE_ERROR_MESSAGES[error.code]) {
      return PROFILE_IMAGE_ERROR_MESSAGES[error.code];
    }

    if (error.status >= 500) {
      return fallbackMessage;
    }

    return error.message || fallbackMessage;
  }

  if (error instanceof Error) {
    return error.message || fallbackMessage;
  }

  return fallbackMessage;
}
