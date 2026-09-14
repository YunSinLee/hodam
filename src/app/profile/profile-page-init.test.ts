import { describe, expect, it } from "vitest";

import {
  createProfileSignInRequiredFeedback,
  resolveProfilePageInitialization,
} from "@/app/profile/profile-page-init";

describe("resolveProfilePageInitialization", () => {
  it("uses existing user id when already authenticated", () => {
    expect(
      resolveProfilePageInitialization({
        currentUserId: "user-existing",
        recoveredUserInfo: {
          id: "user-recovered",
          email: "recovered@example.com",
          profileUrl: "",
        },
      }),
    ).toEqual({
      mode: "existing",
      userId: "user-existing",
      recoveredUserInfo: null,
      shouldSetRecoveredUserInfo: false,
    });
  });

  it("uses recovered session user when current user does not exist", () => {
    expect(
      resolveProfilePageInitialization({
        currentUserId: undefined,
        recoveredUserInfo: {
          id: "user-recovered",
          email: "recovered@example.com",
          profileUrl: "",
        },
      }),
    ).toEqual({
      mode: "recovered",
      userId: "user-recovered",
      recoveredUserInfo: {
        id: "user-recovered",
        email: "recovered@example.com",
        profileUrl: "",
      },
      shouldSetRecoveredUserInfo: true,
    });
  });

  it("returns unauthenticated mode when no usable user exists", () => {
    expect(
      resolveProfilePageInitialization({
        currentUserId: "   ",
        recoveredUserInfo: null,
      }),
    ).toEqual({
      mode: "unauthenticated",
      userId: null,
      recoveredUserInfo: null,
      shouldSetRecoveredUserInfo: false,
    });
  });
});

describe("createProfileSignInRequiredFeedback", () => {
  it("returns canonical sign-in required feedback", () => {
    expect(createProfileSignInRequiredFeedback()).toEqual({
      type: "error",
      message: "로그인이 필요합니다. 다시 로그인해주세요.",
      actionType: "goSignIn",
      actionLabel: "다시 로그인",
    });
  });
});
