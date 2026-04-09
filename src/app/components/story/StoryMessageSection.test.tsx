import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import StoryMessageSection from "@/app/components/story/StoryMessageSection";

describe("StoryMessageSection", () => {
  it("renders nothing when messages are empty", () => {
    const html = renderToStaticMarkup(
      createElement(StoryMessageSection, {
        state: {
          messages: [],
          isEnglishIncluded: false,
          isShowEnglish: false,
          translationInProgress: false,
        },
        handlers: {
          onToggleEnglish: () => {},
          onTranslate: () => {},
        },
      }),
    );

    expect(html).toBe("");
  });

  it("renders translate action when english is not included", () => {
    const html = renderToStaticMarkup(
      createElement(StoryMessageSection, {
        state: {
          messages: [{ text: "옛날 옛적에", text_en: "" }],
          isEnglishIncluded: false,
          isShowEnglish: false,
          translationInProgress: false,
        },
        handlers: {
          onToggleEnglish: () => {},
          onTranslate: () => {},
        },
      }),
    );

    expect(html).toContain("동화 내용");
    expect(html).toContain("영어로 번역하기");
    expect(html).toContain("옛날 옛적에");
  });

  it("renders language toggle action when english is included", () => {
    const html = renderToStaticMarkup(
      createElement(StoryMessageSection, {
        state: {
          messages: [{ text: "호담", text_en: "Hodam" }],
          isEnglishIncluded: true,
          isShowEnglish: true,
          translationInProgress: false,
        },
        handlers: {
          onToggleEnglish: () => {},
          onTranslate: () => {},
        },
      }),
    );

    expect(html).toContain("한국어만 보기");
    expect(html).toContain("Hodam");
  });
});
