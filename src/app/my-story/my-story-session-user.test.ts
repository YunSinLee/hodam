import { describe, expect, it, vi } from "vitest";

import { resolveMyStorySessionUser } from "@/app/my-story/my-story-session-user";

describe("resolveMyStorySessionUser", () => {
  it("returns current user when already usable", async () => {
    const recoverSessionUser = vi.fn(async () => null);

    const result = await resolveMyStorySessionUser({
      currentUser: {
        profileUrl: "",
        id: "user-1",
        email: undefined,
      },
      recoverSessionUser,
    });

    expect(result).toEqual({
      profileUrl: "",
      id: "user-1",
      email: undefined,
    });
    expect(recoverSessionUser).not.toHaveBeenCalled();
  });

  it("recovers user when current user id is empty", async () => {
    const onRecoveredUser = vi.fn();
    const recoverSessionUser = vi.fn(async () => ({
      profileUrl: "",
      id: "recovered-user",
      email: "recovered@example.com",
    }));

    const result = await resolveMyStorySessionUser({
      currentUser: {
        profileUrl: "",
        id: undefined,
        email: undefined,
      },
      recoverSessionUser,
      onRecoveredUser,
    });

    expect(result).toEqual({
      profileUrl: "",
      id: "recovered-user",
      email: "recovered@example.com",
    });
    expect(onRecoveredUser).toHaveBeenCalledTimes(1);
  });

  it("returns null when recovered user is unavailable", async () => {
    const recoverSessionUser = vi.fn(async () => null);

    const result = await resolveMyStorySessionUser({
      currentUser: {
        profileUrl: "",
        id: undefined,
        email: undefined,
      },
      recoverSessionUser,
    });

    expect(result).toBeNull();
  });
});
