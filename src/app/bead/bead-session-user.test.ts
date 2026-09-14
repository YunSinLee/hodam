import { describe, expect, it, vi } from "vitest";

import { resolveBeadSessionUser } from "@/app/bead/bead-session-user";

describe("resolveBeadSessionUser", () => {
  it("returns current user when already usable", async () => {
    const recoverSessionUser = vi.fn(async () => null);

    const result = await resolveBeadSessionUser({
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

  it("recovers and returns user when current user is missing", async () => {
    const onRecoveredUser = vi.fn();
    const recoverSessionUser = vi.fn(async () => ({
      profileUrl: "",
      id: "recovered-user",
      email: "recovered@example.com",
    }));

    const result = await resolveBeadSessionUser(
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

  it("returns null when requireEmail is true and recovered user email is empty", async () => {
    const recoverSessionUser = vi.fn(async () => ({
      profileUrl: "",
      id: "recovered-user",
      email: undefined,
    }));

    const result = await resolveBeadSessionUser(
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
