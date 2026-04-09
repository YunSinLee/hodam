import { describe, expect, it } from "vitest";

import {
  getStoryImageAltText,
  shouldRenderStoryImageLoading,
  shouldRenderStoryImagePanel,
} from "@/app/components/story/story-image-view";
import type { StoryImagePanelState } from "@/app/components/story/story-session-contract";

const baseState: StoryImagePanelState = {
  images: [],
  isImageLoading: false,
  isSelectionLoading: false,
};

describe("story-image-view", () => {
  it("returns image loading visibility only while selection is idle", () => {
    expect(
      shouldRenderStoryImageLoading({
        ...baseState,
        isImageLoading: true,
      }),
    ).toBe(true);
    expect(
      shouldRenderStoryImageLoading({
        ...baseState,
        isImageLoading: true,
        isSelectionLoading: true,
      }),
    ).toBe(false);
  });

  it("shows image panel when there are images or loading placeholder", () => {
    expect(
      shouldRenderStoryImagePanel({
        ...baseState,
        images: ["https://example.com/story.png"],
      }),
    ).toBe(true);
    expect(
      shouldRenderStoryImagePanel({
        ...baseState,
        isImageLoading: true,
      }),
    ).toBe(true);
    expect(shouldRenderStoryImagePanel(baseState)).toBe(false);
  });

  it("builds deterministic image alt text", () => {
    expect(getStoryImageAltText(0)).toBe("동화 이미지 1");
    expect(getStoryImageAltText(2)).toBe("동화 이미지 3");
  });
});
