import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { StoryImagePanelState } from "@/app/components/story/story-session-contract";
import StoryImagePanel from "@/app/components/story/StoryImagePanel";

const baseState: StoryImagePanelState = {
  images: [],
  isImageLoading: false,
  isSelectionLoading: false,
};

describe("StoryImagePanel", () => {
  it("renders nothing when there is no image and loading is inactive", () => {
    const html = renderToStaticMarkup(
      createElement(StoryImagePanel, {
        state: baseState,
      }),
    );

    expect(html).toBe("");
  });

  it("renders image items when story images exist", () => {
    const html = renderToStaticMarkup(
      createElement(StoryImagePanel, {
        state: {
          ...baseState,
          images: [
            "https://example.com/story-1.png",
            "https://example.com/story-2.png",
          ],
        },
      }),
    );

    expect(html).toContain("동화 이미지");
    expect(html).toContain("story-1.png");
    expect(html).toContain("story-2.png");
    expect(html).toContain("동화 이미지 1");
    expect(html).toContain("동화 이미지 2");
  });

  it("renders loading placeholder only during image generation", () => {
    const loadingHtml = renderToStaticMarkup(
      createElement(StoryImagePanel, {
        state: {
          ...baseState,
          isImageLoading: true,
        },
      }),
    );
    const blockedBySelectionHtml = renderToStaticMarkup(
      createElement(StoryImagePanel, {
        state: {
          ...baseState,
          isImageLoading: true,
          isSelectionLoading: true,
        },
      }),
    );

    expect(loadingHtml).toContain("이미지 생성 중...");
    expect(blockedBySelectionHtml).toBe("");
  });
});
