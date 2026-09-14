import { describe, expect, it } from "vitest";

import {
  calculateStoryContinueCost,
  calculateStoryStartCost,
  normalizeStoryKeywords,
} from "@/lib/story/options";

describe("story options", () => {
  describe("calculateStoryStartCost", () => {
    it("returns base cost when no option is selected", () => {
      expect(calculateStoryStartCost({})).toBe(1);
    });

    it("adds cost for english and image options", () => {
      expect(
        calculateStoryStartCost({
          includeEnglish: true,
          includeImage: true,
        }),
      ).toBe(3);
    });
  });

  describe("calculateStoryContinueCost", () => {
    it("adds english option cost", () => {
      expect(calculateStoryContinueCost(false)).toBe(1);
      expect(calculateStoryContinueCost(true)).toBe(2);
    });
  });

  describe("normalizeStoryKeywords", () => {
    it("trims empty entries and deduplicates while preserving order", () => {
      expect(
        normalizeStoryKeywords(" 숲속, 토끼, ,마법,토끼,  모험  "),
      ).toEqual(["숲속", "토끼", "마법", "모험"]);
    });

    it("returns empty array for blank input", () => {
      expect(normalizeStoryKeywords("   ,,  ")).toEqual([]);
    });
  });
});
