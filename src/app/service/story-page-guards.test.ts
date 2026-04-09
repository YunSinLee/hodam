import { describe, expect, it } from "vitest";

import {
  getStoryFeedbackActionTarget,
  guardContinueStoryInput,
  guardStartStoryInput,
} from "@/app/service/story-page-guards";

describe("story-page-guards", () => {
  describe("guardStartStoryInput", () => {
    it("returns goSignIn feedback when user is missing", () => {
      expect(guardStartStoryInput(undefined, "숲속, 토끼")).toEqual({
        ok: false,
        message: "로그인이 필요합니다.",
        action: {
          type: "goSignIn",
          label: "로그인하기",
        },
      });
    });

    it("returns keyword error when payload is empty", () => {
      expect(guardStartStoryInput("user-1", null)).toEqual({
        ok: false,
        message: "키워드를 1개 이상 입력해주세요.",
      });
    });

    it("passes for valid input", () => {
      expect(guardStartStoryInput("user-1", "숲속, 토끼")).toEqual({
        ok: true,
      });
    });
  });

  describe("guardContinueStoryInput", () => {
    it("returns missing thread error", () => {
      expect(guardContinueStoryInput(null, "다음 이야기")).toEqual({
        ok: false,
        message: "동화를 먼저 시작해주세요.",
      });
    });

    it("returns invalid selection error", () => {
      expect(guardContinueStoryInput(1, "   ")).toEqual({
        ok: false,
        message: "선택지가 올바르지 않습니다.",
      });
    });

    it("passes for valid thread and selection", () => {
      expect(guardContinueStoryInput(1, "다음 이야기")).toEqual({
        ok: true,
      });
    });
  });

  describe("getStoryFeedbackActionTarget", () => {
    it("returns sign-in redirect for goSignIn", () => {
      const target = getStoryFeedbackActionTarget({
        type: "goSignIn",
        label: "로그인하기",
      });
      expect(target).toContain("/sign-in?");
      expect(target).toContain("next=%2Fservice");
    });

    it("returns bead page for goBead", () => {
      expect(
        getStoryFeedbackActionTarget({
          type: "goBead",
          label: "곶감 충전",
        }),
      ).toBe("/bead");
    });
  });
});
