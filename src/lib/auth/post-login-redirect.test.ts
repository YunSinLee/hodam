import { beforeEach, describe, expect, it } from "vitest";

import {
  clearPostLoginRedirectPath,
  consumePostLoginRedirectPath,
  postLoginRedirectInternal,
  sanitizePostLoginRedirectPath,
  savePostLoginRedirectPath,
} from "@/lib/auth/post-login-redirect";

function setSessionStorageMock(initial: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(initial));
  const sessionStorage = {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
    removeItem(key: string) {
      map.delete(key);
    },
  };

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      sessionStorage,
    },
  });
}

describe("sanitizePostLoginRedirectPath", () => {
  it("accepts safe internal paths", () => {
    expect(sanitizePostLoginRedirectPath("/my-story/1")).toBe("/my-story/1");
    expect(sanitizePostLoginRedirectPath("/bead?from=home")).toBe(
      "/bead?from=home",
    );
  });

  it("rejects unsafe or invalid paths", () => {
    expect(sanitizePostLoginRedirectPath("https://evil.com")).toBeNull();
    expect(sanitizePostLoginRedirectPath("//evil.com")).toBeNull();
    expect(sanitizePostLoginRedirectPath("javascript-alert")).toBeNull();
    expect(sanitizePostLoginRedirectPath("")).toBeNull();
    expect(sanitizePostLoginRedirectPath(null)).toBeNull();
  });
});

describe("post-login redirect storage helpers", () => {
  beforeEach(() => {
    setSessionStorageMock();
  });

  it("saves and consumes a redirect path", () => {
    const saved = savePostLoginRedirectPath("/my-story/7");
    expect(saved).toBe(true);

    const consumed = consumePostLoginRedirectPath("/");
    expect(consumed).toBe("/my-story/7");

    const consumedAgain = consumePostLoginRedirectPath("/");
    expect(consumedAgain).toBe("/");
  });

  it("clears saved redirect path", () => {
    const key = postLoginRedirectInternal.POST_LOGIN_REDIRECT_KEY;
    setSessionStorageMock({ [key]: "/service" });

    clearPostLoginRedirectPath();
    expect(consumePostLoginRedirectPath("/")).toBe("/");
  });

  it("returns fallback when saved path is unsafe", () => {
    const key = postLoginRedirectInternal.POST_LOGIN_REDIRECT_KEY;
    setSessionStorageMock({ [key]: "https://evil.com" });

    expect(consumePostLoginRedirectPath("/")).toBe("/");
  });
});
