import { describe, expect, it } from "vitest";

import type { StorySessionPanelState } from "@/app/components/story/story-session-contract";
import {
  shouldShowImagePanel,
  shouldShowInitialStoryLoading,
  shouldShowSelectionStoryLoading,
} from "@/app/components/story/story-session-view";

const baseState: StorySessionPanelState = {
  isImageIncluded: false,
  images: [],
  isImageLoading: false,
  isStoryLoading: false,
  isSelectionLoading: false,
  messages: [],
  isEnglishIncluded: false,
  isShowEnglish: false,
  translationInProgress: false,
  notice: "",
  selections: [],
  selectedChoice: "",
};

describe("story-session-view", () => {
  it("computes image panel visibility", () => {
    expect(shouldShowImagePanel(baseState)).toBe(false);
    expect(
      shouldShowImagePanel({
        ...baseState,
        isImageIncluded: true,
      }),
    ).toBe(true);
  });

  it("computes initial loading visibility", () => {
    expect(shouldShowInitialStoryLoading(baseState)).toBe(false);
    expect(
      shouldShowInitialStoryLoading({
        ...baseState,
        isStoryLoading: true,
        isSelectionLoading: false,
      }),
    ).toBe(true);
    expect(
      shouldShowInitialStoryLoading({
        ...baseState,
        isStoryLoading: true,
        isSelectionLoading: true,
      }),
    ).toBe(false);
  });

  it("computes selection loading visibility", () => {
    expect(shouldShowSelectionStoryLoading(baseState)).toBe(false);
    expect(
      shouldShowSelectionStoryLoading({
        ...baseState,
        isStoryLoading: true,
        isSelectionLoading: true,
      }),
    ).toBe(true);
  });
});
