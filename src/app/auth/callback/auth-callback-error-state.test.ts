import { describe, expect, it } from "vitest";

import {
  AUTH_CALLBACK_LOADING_TIMEOUT_MESSAGE,
  resolveUnexpectedAuthCallbackError,
} from "@/app/auth/callback/auth-callback-error-state";

describe("auth-callback-error-state", () => {
  it("exposes loading timeout message", () => {
    expect(AUTH_CALLBACK_LOADING_TIMEOUT_MESSAGE).toBe(
      "로그인 처리가 지연되고 있습니다. 다시 로그인해주세요.",
    );
  });

  it("maps timeout error to timeout recovery code", () => {
    const resolved = resolveUnexpectedAuthCallbackError(
      new Error("getSession timeout (15000ms)"),
    );

    expect(resolved).toEqual({
      message: "로그인 응답이 지연되고 있습니다. 잠시 후 다시 로그인해주세요.",
      recoveryCode: "timeout",
    });
  });

  it("maps generic error to callback_failed with message", () => {
    const resolved = resolveUnexpectedAuthCallbackError(
      new Error("unexpected crash"),
    );

    expect(resolved.message).toContain("unexpected crash");
    expect(resolved.recoveryCode).toBe("callback_failed");
  });

  it("maps unknown value to callback_failed fallback", () => {
    const resolved = resolveUnexpectedAuthCallbackError("string-error");

    expect(resolved).toEqual({
      message: "예상치 못한 오류가 발생했습니다.",
      recoveryCode: "callback_failed",
    });
  });
});
