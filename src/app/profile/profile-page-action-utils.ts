import type {
  ProfilePageFeedbackActionType,
  ProfileConfirmAction,
  ProfilePageFeedback,
} from "@/app/profile/profile-page-contract";

export function sanitizeNickname(value: string): string {
  return value.trim();
}

export function canSubmitNicknameUpdate(
  userId: string | undefined,
  sanitizedNickname: string,
): boolean {
  return Boolean(userId && sanitizedNickname);
}

export function resolveNicknameUpdateFeedback(
  success: boolean,
): ProfilePageFeedback {
  if (success) {
    return {
      type: "success",
      message: "닉네임이 성공적으로 변경되었습니다.",
    };
  }

  return {
    type: "error",
    message: "닉네임 업데이트에 실패했습니다. 다시 시도해주세요.",
  };
}

export function resolveProfileImageUploadFeedback(
  success: boolean,
): ProfilePageFeedback {
  if (success) {
    return {
      type: "success",
      message: "프로필 이미지가 업데이트되었습니다.",
    };
  }

  return {
    type: "error",
    message: "이미지 업로드에 실패했습니다.",
  };
}

export function resolveProfileImageRemoveFeedback(
  success: boolean,
): ProfilePageFeedback {
  if (success) {
    return {
      type: "success",
      message: "프로필 이미지가 기본 이미지로 변경되었습니다.",
    };
  }

  return {
    type: "error",
    message: "이미지 삭제에 실패했습니다.",
  };
}

export function resolveConfirmActionType(
  action: ProfileConfirmAction,
): "logout" | "removeImage" | null {
  if (action === "logout") return "logout";
  if (action === "removeImage") return "removeImage";
  return null;
}

export function resolveProfilePageFeedbackIntent(
  actionType?: ProfilePageFeedbackActionType,
): "goSignIn" | "retry" | "none" {
  if (actionType === "goSignIn") return "goSignIn";
  if (actionType === "retry") return "retry";
  return "none";
}

export function hasProfilePageFeedbackAction(
  actionType?: ProfilePageFeedbackActionType,
): boolean {
  return resolveProfilePageFeedbackIntent(actionType) !== "none";
}
