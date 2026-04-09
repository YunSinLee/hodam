import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { StorySessionPanelState } from "@/app/components/story/story-session-contract";
import StorySessionPanel from "@/app/components/story/StorySessionPanel";

const handlers = {
  onToggleEnglish: () => {},
  onTranslate: () => {},
  onSelectionClick: () => {},
};

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

describe("StorySessionPanel", () => {
  it("renders initial story loading notice", () => {
    const html = renderToStaticMarkup(
      createElement(StorySessionPanel, {
        state: {
          ...baseState,
          isStoryLoading: true,
          isSelectionLoading: false,
        },
        handlers,
      }),
    );

    expect(html).toContain("첫 번째 동화를 생성하고 있습니다...");
  });

  it("renders selection loading notice while continuing story", () => {
    const html = renderToStaticMarkup(
      createElement(StorySessionPanel, {
        state: {
          ...baseState,
          isStoryLoading: true,
          isSelectionLoading: true,
          messages: [{ text: "문장", text_en: "" }],
        },
        handlers,
      }),
    );

    expect(html).toContain("새로운 이야기를 생성하고 있습니다...");
    expect(html).toContain("선택하신 내용을 바탕으로 동화를 이어가고 있어요.");
  });

  it("renders image section when image option is enabled", () => {
    const html = renderToStaticMarkup(
      createElement(StorySessionPanel, {
        state: {
          ...baseState,
          isImageIncluded: true,
          images: ["https://example.com/story.png"],
          messages: [{ text: "동화", text_en: "" }],
        },
        handlers,
      }),
    );

    expect(html).toContain("동화 이미지");
    expect(html).toContain("story.png");
  });
});
