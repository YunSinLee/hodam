import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/client/api/http";
import {
  getProtectedPageFeedbackAction,
  resolveProtectedPageErrorState,
} from "@/lib/ui/protected-page-error";

describe("resolveProtectedPageErrorState", () => {
  const fallbackMessage =
    "데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.";

  it("prioritizes AUTH_UNAUTHORIZED error code", () => {
    const state = resolveProtectedPageErrorState(
      new ApiError(500, "Internal", {
        code: "AUTH_UNAUTHORIZED",
      }),
      fallbackMessage,
    );

    expect(state).toEqual({
      message: "로그인 세션이 만료되었습니다. 다시 로그인해주세요.",
      shouldRedirectToSignIn: true,
    });
  });

  it("maps *_RATE_LIMITED error code to throttling message", () => {
    const state = resolveProtectedPageErrorState(
      new ApiError(400, "unexpected", {
        code: "PROFILE_SUMMARY_RATE_LIMITED",
      }),
      fallbackMessage,
    );

    expect(state).toEqual({
      message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
      shouldRedirectToSignIn: false,
    });
  });

  it("maps *_FETCH_FAILED error code to fallback message", () => {
    const state = resolveProtectedPageErrorState(
      new ApiError(400, "unexpected", {
        code: "PROFILE_SUMMARY_FETCH_FAILED",
      }),
      fallbackMessage,
    );

    expect(state).toEqual({
      message: fallbackMessage,
      shouldRedirectToSignIn: false,
    });
  });

  it("returns sign-in redirect state for 401", () => {
    const state = resolveProtectedPageErrorState(
      new ApiError(401, "Unauthorized"),
      fallbackMessage,
    );

    expect(state).toEqual({
      message: "로그인 세션이 만료되었습니다. 다시 로그인해주세요.",
      shouldRedirectToSignIn: true,
    });
  });

  it("returns throttling message for 429", () => {
    const state = resolveProtectedPageErrorState(
      new ApiError(429, "Too many requests"),
      fallbackMessage,
    );

    expect(state).toEqual({
      message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
      shouldRedirectToSignIn: false,
    });
  });

  it("returns fallback for server errors", () => {
    const state = resolveProtectedPageErrorState(
      new ApiError(500, "Internal"),
      fallbackMessage,
    );

    expect(state).toEqual({
      message: fallbackMessage,
      shouldRedirectToSignIn: false,
    });
  });

  it("returns ApiError message for non-auth client errors", () => {
    const state = resolveProtectedPageErrorState(
      new ApiError(400, "잘못된 요청"),
      fallbackMessage,
    );

    expect(state).toEqual({
      message: "잘못된 요청",
      shouldRedirectToSignIn: false,
    });
  });

  it("returns fallback for unknown thrown values", () => {
    const state = resolveProtectedPageErrorState("boom", fallbackMessage);
    expect(state).toEqual({
      message: fallbackMessage,
      shouldRedirectToSignIn: false,
    });
  });

  it("returns goSignIn action for redirect errors", () => {
    const action = getProtectedPageFeedbackAction({
      message: "로그인 세션이 만료되었습니다.",
      shouldRedirectToSignIn: true,
    });

    expect(action).toEqual({
      type: "goSignIn",
      label: "다시 로그인",
    });
  });

  it("returns retry action for non-redirect errors", () => {
    const action = getProtectedPageFeedbackAction({
      message: "잠시 후 다시 시도해주세요.",
      shouldRedirectToSignIn: false,
    });

    expect(action).toEqual({
      type: "retry",
      label: "다시 시도",
    });
  });
});
