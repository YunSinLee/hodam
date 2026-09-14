import { describe, expect, it } from "vitest";

import {
  toStoryGuardFailureFeedback,
  toStoryRequestErrorFeedback,
} from "@/app/service/story-page-feedback";
import { ApiError } from "@/lib/client/api/http";

describe("story-page-feedback", () => {
  it("maps guard failure to page feedback", () => {
    const feedback = toStoryGuardFailureFeedback({
      ok: false,
      message: "로그인이 필요합니다.",
      action: {
        type: "goSignIn",
        label: "로그인하기",
      },
    });

    expect(feedback).toEqual({
      type: "error",
      message: "로그인이 필요합니다.",
      action: {
        type: "goSignIn",
        label: "로그인하기",
      },
    });
  });

  it("maps request error using service feedback resolver", () => {
    const feedback = toStoryRequestErrorFeedback(
      new ApiError(402, "bead 부족"),
    );

    expect(feedback.type).toBe("error");
    expect(feedback.message.length).toBeGreaterThan(0);
    expect(feedback.action).not.toBeNull();
  });
});
