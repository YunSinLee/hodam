import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/client/api/http";
import { resolveThreadListErrorState } from "@/lib/ui/thread-list-error";

describe("resolveThreadListErrorState", () => {
  it("prioritizes AUTH_UNAUTHORIZED error code", () => {
    const state = resolveThreadListErrorState(
      new ApiError(500, "unexpected", {
        code: "AUTH_UNAUTHORIZED",
      }),
    );
    expect(state).toEqual({
      message: "로그인 세션이 만료되었습니다. 다시 로그인해주세요.",
      shouldRedirectToSignIn: true,
    });
  });

  it("maps THREAD_LIST_RATE_LIMITED code to throttling message", () => {
    const state = resolveThreadListErrorState(
      new ApiError(400, "unexpected", {
        code: "THREAD_LIST_RATE_LIMITED",
      }),
    );
    expect(state).toEqual({
      message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
      shouldRedirectToSignIn: false,
    });
  });

  it("returns sign-in redirect state for 401", () => {
    const state = resolveThreadListErrorState(
      new ApiError(401, "Unauthorized"),
    );
    expect(state).toEqual({
      message: "로그인 세션이 만료되었습니다. 다시 로그인해주세요.",
      shouldRedirectToSignIn: true,
    });
  });

  it("returns throttling message for 429", () => {
    const state = resolveThreadListErrorState(
      new ApiError(429, "Too many requests"),
    );
    expect(state).toEqual({
      message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
      shouldRedirectToSignIn: false,
    });
  });

  it("returns server message for 500+", () => {
    const state = resolveThreadListErrorState(new ApiError(500, "internal"));
    expect(state).toEqual({
      message:
        "서버에서 동화 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
      shouldRedirectToSignIn: false,
    });
  });

  it("returns generic fallback for unknown values", () => {
    const state = resolveThreadListErrorState("boom");
    expect(state).toEqual({
      message: "동화 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
      shouldRedirectToSignIn: false,
    });
  });
});
