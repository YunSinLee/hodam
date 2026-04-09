import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/client/api/http";
import {
  resolveStoryServiceError,
  resolveStoryServiceFeedback,
} from "@/lib/ui/story-service-error";

describe("resolveStoryServiceError", () => {
  it("returns mapped message for daily ai limit code", () => {
    expect(
      resolveStoryServiceError(
        new ApiError(429, "daily cost exceeded", {
          code: "DAILY_AI_COST_LIMIT_EXCEEDED",
        }),
      ),
    ).toBe("오늘 생성 한도에 도달했습니다. 내일 다시 시도해주세요.");
  });

  it("returns mapped message for thread not found code", () => {
    expect(
      resolveStoryServiceError(
        new ApiError(404, "Thread not found", {
          code: "THREAD_NOT_FOUND",
        }),
      ),
    ).toBe("동화를 찾을 수 없습니다. 다시 시도해주세요.");
  });

  it("returns mapped message for blocked topic code", () => {
    expect(
      resolveStoryServiceError(
        new ApiError(400, "unsafe topic", {
          code: "STORY_START_BLOCKED_TOPIC",
        }),
      ),
    ).toBe("안전하지 않은 주제는 사용할 수 없습니다.");
  });

  it("returns mapped message for blocked output code", () => {
    expect(
      resolveStoryServiceError(
        new ApiError(400, "unsafe output", {
          code: "STORY_TRANSLATE_BLOCKED_OUTPUT",
        }),
      ),
    ).toBe(
      "생성된 내용이 안전 정책에 의해 차단되었습니다. 다른 입력으로 다시 시도해주세요.",
    );
  });

  it("returns auth message for 401", () => {
    expect(resolveStoryServiceError(new ApiError(401, "Unauthorized"))).toBe(
      "로그인이 필요합니다.",
    );
  });

  it("returns payment message for 402", () => {
    expect(
      resolveStoryServiceError(new ApiError(402, "Payment required")),
    ).toBe("곶감이 부족합니다.");
  });

  it("returns throttling message for 429", () => {
    expect(
      resolveStoryServiceError(new ApiError(429, "Too many requests")),
    ).toBe("요청이 너무 많습니다. 잠시 후 다시 시도해주세요.");
  });

  it("returns api message for other status", () => {
    expect(resolveStoryServiceError(new ApiError(500, "server exploded"))).toBe(
      "server exploded",
    );
  });

  it("returns error message from Error object", () => {
    expect(resolveStoryServiceError(new Error("boom"))).toBe("boom");
  });

  it("returns fallback message for unknown values", () => {
    expect(resolveStoryServiceError("unknown")).toBe(
      "요청 처리 중 오류가 발생했습니다.",
    );
  });
});

describe("resolveStoryServiceFeedback", () => {
  it("adds goSignIn action for auth errors", () => {
    expect(
      resolveStoryServiceFeedback(
        new ApiError(401, "Unauthorized", {
          code: "AUTH_UNAUTHORIZED",
        }),
      ),
    ).toEqual({
      message: "로그인이 필요합니다.",
      action: {
        type: "goSignIn",
        label: "로그인하기",
      },
    });
  });

  it("adds goBead action for bead insufficient errors", () => {
    expect(
      resolveStoryServiceFeedback(
        new ApiError(402, "Payment required", {
          code: "BEADS_INSUFFICIENT",
        }),
      ),
    ).toEqual({
      message: "곶감이 부족합니다.",
      action: {
        type: "goBead",
        label: "곶감 충전",
      },
    });
  });

  it("does not add action for generic errors", () => {
    expect(resolveStoryServiceFeedback(new Error("boom"))).toEqual({
      message: "boom",
      action: null,
    });
  });
});
