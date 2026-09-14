import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import KeywordInput from "@/app/components/KeywordInput";

const baseHandlers = {
  onKeywordsChange: () => {},
  onButtonClicked: () => {},
  onEnglishIncludedChange: () => {},
  onImageIncludedChange: () => {},
};

describe("KeywordInput", () => {
  it("renders disabled submit button when keywords are empty", () => {
    const html = renderToStaticMarkup(
      createElement(KeywordInput, {
        neededBeadCount: 2,
        keywords: "   ",
        isEnglishIncluded: false,
        isImageIncluded: false,
        ...baseHandlers,
      }),
    );

    expect(html).toContain("필요한 곶감:");
    expect(html).toContain(">2<");
    expect(html).toContain("동화 만들기 시작");
    expect(html).toContain("cursor-not-allowed");
    expect(html).toContain("disabled");
  });

  it("renders enabled submit button when keywords are present", () => {
    const html = renderToStaticMarkup(
      createElement(KeywordInput, {
        neededBeadCount: 3,
        keywords: "숲속, 토끼",
        isEnglishIncluded: false,
        isImageIncluded: false,
        ...baseHandlers,
      }),
    );

    expect(html).toContain("bg-orange-500");
    expect(html).toContain("hover:bg-orange-600");
    expect(html).not.toContain("cursor-not-allowed");
  });

  it("renders active toggle styles when options are enabled", () => {
    const html = renderToStaticMarkup(
      createElement(KeywordInput, {
        neededBeadCount: 3,
        keywords: "숲속, 토끼",
        isEnglishIncluded: true,
        isImageIncluded: true,
        ...baseHandlers,
      }),
    );

    expect(html).toContain("영어 번역 (+1 곶감)");
    expect(html).toContain("그림 생성 (+1 곶감)");
    expect(html).toContain("border-orange-400 bg-orange-50 text-orange-700");
  });
});
