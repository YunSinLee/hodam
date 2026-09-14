import { describe, expect, it } from "vitest";

import type { StorySelectionSectionState } from "@/app/components/story/story-selection-contract";
import { shouldRenderSelectionBlock } from "@/app/components/story/story-selection-view";

const baseState: StorySelectionSectionState = {
  notice: "",
  selections: [],
  isShowEnglish: false,
  selectedChoice: "",
  isSelectionLoading: false,
};

describe("story-selection-view", () => {
  it("returns false when no notice and no selection/loading", () => {
    expect(shouldRenderSelectionBlock(baseState)).toBe(false);
  });

  it("returns true when selections exist", () => {
    expect(
      shouldRenderSelectionBlock({
        ...baseState,
        selections: [{ text: "다음 전개", text_en: "Next plot" }],
      }),
    ).toBe(true);
  });

  it("returns true when loading is active", () => {
    expect(
      shouldRenderSelectionBlock({
        ...baseState,
        isSelectionLoading: true,
      }),
    ).toBe(true);
  });
});
