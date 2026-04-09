import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import StorySelectionSection from "@/app/components/story/StorySelectionSection";

describe("StorySelectionSection", () => {
  it("renders nothing when selection block and notice are empty", () => {
    const html = renderToStaticMarkup(
      createElement(StorySelectionSection, {
        state: {
          notice: "",
          selections: [],
          isShowEnglish: false,
          selectedChoice: "",
          isSelectionLoading: false,
        },
        handlers: {
          onSelectionClick: () => {},
        },
      }),
    );

    expect(html).toBe("");
  });

  it("renders notice and selection header when choices exist", () => {
    const html = renderToStaticMarkup(
      createElement(StorySelectionSection, {
        state: {
          notice: "이야기가 더 흥미로워져요.",
          selections: [{ text: "숲으로 간다", text_en: "Go to forest" }],
          isShowEnglish: true,
          selectedChoice: "",
          isSelectionLoading: false,
        },
        handlers: {
          onSelectionClick: () => {},
        },
      }),
    );

    expect(html).toContain("이야기가 더 흥미로워져요.");
    expect(html).toContain("다음 전개를 선택하세요");
    expect(html).toContain("숲으로 간다");
    expect(html).toContain("Go to forest");
  });
});
