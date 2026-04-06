import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/client/api/http";
import {
  resolveThreadDetailErrorMessage,
  resolveThreadDetailErrorState,
} from "@/lib/ui/thread-detail-error";

describe("resolveThreadDetailErrorMessage", () => {
  it("maps 401 to session-expired message", () => {
    const message = resolveThreadDetailErrorMessage(
      new ApiError(401, "Unauthorized"),
    );
    expect(message).toBe("로그인 세션이 만료되었습니다. 다시 로그인해주세요.");
  });

  it("maps 404 to not-found message", () => {
    const message = resolveThreadDetailErrorMessage(
      new ApiError(404, "Thread not found"),
    );
    expect(message).toBe(
      "해당 동화를 찾을 수 없습니다. 목록에서 다른 동화를 선택해주세요.",
    );
  });

  it("maps 429 to rate-limit message", () => {
    const message = resolveThreadDetailErrorMessage(
      new ApiError(429, "Too many requests"),
    );
    expect(message).toBe("요청이 너무 많습니다. 잠시 후 다시 시도해주세요.");
  });

  it("maps 500+ to server-failure message", () => {
    const message = resolveThreadDetailErrorMessage(
      new ApiError(500, "Internal Error"),
    );
    expect(message).toBe(
      "서버에서 동화 상세를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
    );
  });

  it("returns original ApiError message for other statuses", () => {
    const message = resolveThreadDetailErrorMessage(
      new ApiError(400, "Invalid threadId"),
    );
    expect(message).toBe("Invalid threadId");
  });

  it("returns generic fallback for unknown thrown values", () => {
    expect(resolveThreadDetailErrorMessage("boom")).toBe(
      "동화 상세를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
    );
  });
});

describe("resolveThreadDetailErrorState", () => {
  it("returns sign-in redirect state for 401", () => {
    const state = resolveThreadDetailErrorState(
      new ApiError(401, "Unauthorized"),
    );
    expect(state).toEqual({
      message: "로그인 세션이 만료되었습니다. 다시 로그인해주세요.",
      shouldRedirectToSignIn: true,
    });
  });

  it("does not redirect for non-auth errors", () => {
    const state = resolveThreadDetailErrorState(
      new ApiError(500, "internal error"),
    );
    expect(state.shouldRedirectToSignIn).toBe(false);
  });
});
