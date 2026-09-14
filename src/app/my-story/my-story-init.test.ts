import { describe, expect, it } from "vitest";

import {
  createMyStorySignInRequiredError,
  resolveMyStoryInitialization,
} from "@/app/my-story/my-story-init";

describe("resolveMyStoryInitialization", () => {
  it("uses existing user id when already authenticated", () => {
    const result = resolveMyStoryInitialization({
      currentUserId: "existing-user-id",
      recoveredUserInfo: {
        profileUrl: "",
        id: "recovered-user-id",
        email: "recovered@example.com",
      },
    });

    expect(result).toEqual({
      mode: "existing",
      userId: "existing-user-id",
      recoveredUserInfo: null,
      shouldSetRecoveredUserInfo: false,
    });
  });

  it("uses recovered session user when current user does not exist", () => {
    const recoveredUserInfo = {
      profileUrl: "",
      id: "recovered-user-id",
      email: "recovered@example.com",
    };
    const result = resolveMyStoryInitialization({
      currentUserId: undefined,
      recoveredUserInfo,
    });

    expect(result).toEqual({
      mode: "recovered",
      userId: "recovered-user-id",
      recoveredUserInfo,
      shouldSetRecoveredUserInfo: true,
    });
  });

  it("returns unauthenticated mode when no usable user exists", () => {
    const result = resolveMyStoryInitialization({
      currentUserId: "   ",
      recoveredUserInfo: null,
    });

    expect(result).toEqual({
      mode: "unauthenticated",
      userId: null,
      recoveredUserInfo: null,
      shouldSetRecoveredUserInfo: false,
    });
  });
});

describe("createMyStorySignInRequiredError", () => {
  it("returns canonical sign-in required error", () => {
    expect(createMyStorySignInRequiredError()).toEqual({
      message: "로그인이 필요합니다. 다시 로그인해주세요.",
      actionLabel: "다시 로그인",
    });
  });
});
