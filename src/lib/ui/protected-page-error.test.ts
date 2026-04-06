import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/client/api/http";
import { resolveProtectedPageErrorState } from "@/lib/ui/protected-page-error";

describe("resolveProtectedPageErrorState", () => {
  const fallbackMessage =
    "데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.";

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
});
