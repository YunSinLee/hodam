import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import userApi from "@/app/api/user";

const { signInWithKakao, signInWithGoogle, signOut, saveRedirect } = vi.hoisted(
  () => ({
    signInWithKakao: vi.fn(),
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
    saveRedirect: vi.fn(),
  }),
);

vi.mock("@/lib/client/api/user", () => ({
  default: { signInWithKakao, signInWithGoogle, signOut },
}));
vi.mock("@/lib/auth/post-login-redirect", () => ({
  savePostLoginRedirectPath: saveRedirect,
}));

describe("legacy user API compatibility", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("saves the QA return path and delegates to the canonical OAuth client", async () => {
    await userApi.signInWithKakao("/service?draft=1#preview");

    expect(saveRedirect).toHaveBeenCalledWith("/service?draft=1#preview");
    expect(signInWithKakao).toHaveBeenCalledOnce();
    expect(signInWithGoogle).not.toHaveBeenCalled();
  });

  it("replaces unsafe return paths before starting OAuth", async () => {
    await userApi.signInWithGoogle("/\\evil.com");

    expect(saveRedirect).toHaveBeenCalledWith("/service");
    expect(signInWithGoogle).toHaveBeenCalledOnce();
  });

  it("clears private drafts and obsolete persisted identity after successful logout", async () => {
    const removeSessionItem = vi.fn();
    const removeLocalItem = vi.fn();
    vi.stubGlobal("sessionStorage", { removeItem: removeSessionItem });
    vi.stubGlobal("localStorage", { removeItem: removeLocalItem });

    await userApi.signOut();

    expect(signOut).toHaveBeenCalledOnce();
    expect(removeSessionItem).toHaveBeenCalledWith("hodam-picturebook-input");
    expect(removeSessionItem).toHaveBeenCalledWith("hodam:post-login-next");
    expect(removeLocalItem).toHaveBeenCalledWith("hodam-user-info");
    expect(removeLocalItem).toHaveBeenCalledWith("hodam-bead-info");
  });

  it("preserves user state when canonical logout fails", async () => {
    const removeItem = vi.fn();
    vi.stubGlobal("sessionStorage", { removeItem });
    signOut.mockRejectedValue(new Error("offline"));

    await expect(userApi.signOut()).rejects.toThrow("offline");
    expect(removeItem).not.toHaveBeenCalled();
  });

  it("does not fail logout when browser storage is disabled", async () => {
    vi.stubGlobal("sessionStorage", {
      removeItem: () => {
        throw new Error("Storage disabled");
      },
    });

    await expect(userApi.signOut()).resolves.toBeUndefined();
  });
});
