import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import MyStoryDetailContent from "@/app/components/my-story-detail/MyStoryDetailContent";

describe("MyStoryDetailContent", () => {
  it("renders loading state when detail is loading", () => {
    const html = renderToStaticMarkup(
      createElement(MyStoryDetailContent, {
        isLoading: true,
        imageUrl: null,
        messages: [],
        ableEnglish: false,
        isShowEnglish: false,
        errorMessage: null,
        onRetry: () => {},
      }),
    );

    expect(html).toContain("동화를 불러오는 중...");
  });

  it("renders empty state when messages are unavailable", () => {
    const html = renderToStaticMarkup(
      createElement(MyStoryDetailContent, {
        isLoading: false,
        imageUrl: null,
        messages: [],
        ableEnglish: false,
        isShowEnglish: false,
        errorMessage: "동화를 찾을 수 없습니다.",
        onRetry: () => {},
      }),
    );

    expect(html).toContain("동화 상세를 불러오지 못했어요");
    expect(html).toContain("동화를 찾을 수 없습니다.");
  });

  it("renders image/message sections when messages are present", () => {
    const html = renderToStaticMarkup(
      createElement(MyStoryDetailContent, {
        isLoading: false,
        imageUrl: "https://example.com/story.png",
        messages: [
          {
            text: "옛날 옛적에...",
            text_en: "Once upon a time...",
          },
        ],
        ableEnglish: true,
        isShowEnglish: true,
        errorMessage: null,
        onRetry: () => {},
      }),
    );

    expect(html).toContain("동화 일러스트");
    expect(html).toContain("동화 내용");
    expect(html).toContain("story.png");
  });
});
