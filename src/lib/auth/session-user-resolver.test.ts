import { describe, expect, it, vi } from "vitest";

import { resolveSessionUser } from "@/lib/auth/session-user-resolver";

describe("resolveSessionUser", () => {
  it("returns current user when it already has a usable id", async () => {
    const recoverSessionUser = vi.fn(async () => null);

    const result = await resolveSessionUser({
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

  it("recovers user and invokes onRecoveredUser when current user is missing", async () => {
    const onRecoveredUser = vi.fn();
    const recoverSessionUser = vi.fn(async () => ({
      profileUrl: "",
      id: "recovered-user",
      email: "recovered@example.com",
    }));

    const result = await resolveSessionUser(
      {
        currentUser: {
          profileUrl: "",
          id: undefined,
          email: undefined,
        },
        recoverSessionUser,
        onRecoveredUser,
      },
      { requireEmail: true },
    );

    expect(result).toEqual({
      profileUrl: "",
      id: "recovered-user",
      email: "recovered@example.com",
    });
    expect(onRecoveredUser).toHaveBeenCalledTimes(1);
  });

  it("returns null when recovered user is missing email but email is required", async () => {
    const recoverSessionUser = vi.fn(async () => ({
      profileUrl: "",
      id: "recovered-user",
      email: undefined,
    }));

    const result = await resolveSessionUser(
      {
        currentUser: {
          profileUrl: "",
          id: undefined,
          email: undefined,
        },
        recoverSessionUser,
      },
      { requireEmail: true },
    );

    expect(result).toBeNull();
  });
});
