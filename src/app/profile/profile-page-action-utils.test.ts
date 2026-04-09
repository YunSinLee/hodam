import { describe, expect, it } from "vitest";

import {
  canSubmitNicknameUpdate,
  hasProfilePageFeedbackAction,
  resolveConfirmActionType,
  resolveNicknameUpdateFeedback,
  resolveProfilePageFeedbackIntent,
  resolveProfileImageRemoveFeedback,
  resolveProfileImageUploadFeedback,
  sanitizeNickname,
} from "@/app/profile/profile-page-action-utils";

describe("profile-page-action-utils", () => {
  it("sanitizes nickname with trim", () => {
    expect(sanitizeNickname("  호담  ")).toBe("호담");
  });

  it("validates nickname submit preconditions", () => {
    expect(canSubmitNicknameUpdate("user-1", "닉네임")).toBe(true);
    expect(canSubmitNicknameUpdate(undefined, "닉네임")).toBe(false);
    expect(canSubmitNicknameUpdate("user-1", "")).toBe(false);
  });

  it("builds nickname update feedback", () => {
    expect(resolveNicknameUpdateFeedback(true)).toEqual({
      type: "success",
      message: "닉네임이 성공적으로 변경되었습니다.",
    });
    expect(resolveNicknameUpdateFeedback(false)).toEqual({
      type: "error",
      message: "닉네임 업데이트에 실패했습니다. 다시 시도해주세요.",
    });
  });

  it("builds image upload feedback", () => {
    expect(resolveProfileImageUploadFeedback(true)).toEqual({
      type: "success",
      message: "프로필 이미지가 업데이트되었습니다.",
    });
    expect(resolveProfileImageUploadFeedback(false)).toEqual({
      type: "error",
      message: "이미지 업로드에 실패했습니다.",
    });
  });

  it("builds image remove feedback", () => {
    expect(resolveProfileImageRemoveFeedback(true)).toEqual({
      type: "success",
      message: "프로필 이미지가 기본 이미지로 변경되었습니다.",
    });
    expect(resolveProfileImageRemoveFeedback(false)).toEqual({
      type: "error",
      message: "이미지 삭제에 실패했습니다.",
    });
  });

  it("resolves confirm action type", () => {
    expect(resolveConfirmActionType("logout")).toBe("logout");
    expect(resolveConfirmActionType("removeImage")).toBe("removeImage");
    expect(resolveConfirmActionType(null)).toBeNull();
  });

  it("resolves feedback intent and action visibility", () => {
    expect(resolveProfilePageFeedbackIntent("goSignIn")).toBe("goSignIn");
    expect(resolveProfilePageFeedbackIntent("retry")).toBe("retry");
    expect(resolveProfilePageFeedbackIntent(undefined)).toBe("none");

    expect(hasProfilePageFeedbackAction("goSignIn")).toBe(true);
    expect(hasProfilePageFeedbackAction("retry")).toBe(true);
    expect(hasProfilePageFeedbackAction(undefined)).toBe(false);
  });
});
