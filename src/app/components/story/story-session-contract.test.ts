import { describe, expect, it } from "vitest";

import {
  toStoryImagePanelState,
  toStorySelectionSectionState,
} from "@/app/components/story/story-session-contract";
import type { StorySessionPanelState } from "@/app/components/story/story-session-contract";

const baseState: StorySessionPanelState = {
  isImageIncluded: true,
  images: ["https://example.com/story.png"],
  isImageLoading: true,
  isStoryLoading: false,
  isSelectionLoading: false,
  messages: [{ text: "동화", text_en: "Story" }],
  isEnglishIncluded: true,
  isShowEnglish: false,
  translationInProgress: false,
  notice: "알림",
  selections: [{ text: "숲으로 간다", text_en: "Go to forest" }],
  selectedChoice: "숲으로 간다",
};

describe("story-session-contract", () => {
  it("maps story image panel state from session state", () => {
    expect(toStoryImagePanelState(baseState)).toEqual({
      images: ["https://example.com/story.png"],
      isImageLoading: true,
      isSelectionLoading: false,
    });
  });

  it("maps story selection section state from session state", () => {
    expect(toStorySelectionSectionState(baseState)).toEqual({
      notice: "알림",
      selections: [{ text: "숲으로 간다", text_en: "Go to forest" }],
      isShowEnglish: false,
      selectedChoice: "숲으로 간다",
      isSelectionLoading: false,
    });
  });
});
