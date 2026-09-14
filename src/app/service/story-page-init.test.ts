import { describe, expect, it } from "vitest";

import { resolveStoryPageInitialization } from "@/app/service/story-page-init";

describe("resolveStoryPageInitialization", () => {
  it("keeps current user when already authenticated", () => {
    const result = resolveStoryPageInitialization({
      currentUserId: "user-1",
      recoveredUserInfo: {
        profileUrl: "",
        id: "recovered-user",
        email: "recovered@example.com",
      },
    });

    expect(result).toEqual({
      mode: "ready",
      userId: "user-1",
      shouldSetRecoveredUserInfo: false,
      recoveredUserInfo: null,
    });
  });

  it("uses recovered session user when current user is missing", () => {
    const recoveredUserInfo = {
      profileUrl: "",
      id: "recovered-user",
      email: "recovered@example.com",
    };

    const result = resolveStoryPageInitialization({
      currentUserId: undefined,
      recoveredUserInfo,
    });

    expect(result).toEqual({
      mode: "ready",
      userId: "recovered-user",
      shouldSetRecoveredUserInfo: true,
      recoveredUserInfo,
    });
  });

  it("keeps unauthenticated state when no user is available", () => {
    const result = resolveStoryPageInitialization({
      currentUserId: undefined,
      recoveredUserInfo: null,
    });

    expect(result).toEqual({
      mode: "ready",
      userId: undefined,
      shouldSetRecoveredUserInfo: false,
      recoveredUserInfo: null,
    });
  });
});
