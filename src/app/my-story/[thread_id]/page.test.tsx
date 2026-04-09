import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import MyStoryDetailPage from "@/app/my-story/[thread_id]/page";
import useMyStoryDetailController from "@/app/my-story/[thread_id]/useMyStoryDetailController";

vi.mock("@/app/my-story/[thread_id]/useMyStoryDetailController", () => ({
  default: vi.fn(),
}));

const mockUseMyStoryDetailController =
  useMyStoryDetailController as unknown as Mock;

describe("MyStory detail page", () => {
  beforeEach(() => {
    mockUseMyStoryDetailController.mockReset();
  });

  it("renders loading skeleton while detail is loading", () => {
    mockUseMyStoryDetailController.mockReturnValue({
      statusState: {
        isLoading: true,
        isPageLoaded: false,
      },
      pageState: {
        threadId: "123",
        ableEnglish: false,
        isShowEnglish: false,
        imageUrl: null,
        messages: [],
        errorMessage: null,
        diagnostics: null,
      },
      handlers: {
        onRetry: () => {},
        onToggleEnglish: () => {},
      },
    });

    const html = renderToStaticMarkup(createElement(MyStoryDetailPage));

    expect(html).toContain("동화를 불러오는 중...");
    expect(html).toContain("opacity-0");
  });

  it("renders empty state when messages are missing", () => {
    mockUseMyStoryDetailController.mockReturnValue({
      statusState: {
        isLoading: false,
        isPageLoaded: true,
      },
      pageState: {
        threadId: "321",
        ableEnglish: false,
        isShowEnglish: false,
        imageUrl: null,
        messages: [],
        errorMessage: "동화를 찾을 수 없습니다.",
        diagnostics: null,
      },
      handlers: {
        onRetry: () => {},
        onToggleEnglish: () => {},
      },
    });

    const html = renderToStaticMarkup(createElement(MyStoryDetailPage));

    expect(html).toContain("동화 상세를 불러오지 못했어요");
    expect(html).toContain("동화를 찾을 수 없습니다.");
    expect(html).toContain("새 동화 만들기");
  });

  it("renders diagnostics and message section when detail exists", () => {
    mockUseMyStoryDetailController.mockReturnValue({
      statusState: {
        isLoading: false,
        isPageLoaded: true,
      },
      pageState: {
        threadId: "777",
        ableEnglish: true,
        isShowEnglish: true,
        imageUrl: "https://example.com/story.png",
        messages: [
          {
            text: "옛날 옛적에...",
            text_en: "Once upon a time...",
          },
        ],
        errorMessage: null,
        diagnostics: {
          source: "fallback",
          degraded: true,
          reasons: ["rpc_error"],
        },
      },
      handlers: {
        onRetry: () => {},
        onToggleEnglish: () => {},
      },
    });

    const html = renderToStaticMarkup(createElement(MyStoryDetailPage));

    expect(html).toContain("동화 상세를 예비 경로로 불러왔어요");
    expect(html).toContain("언어:");
    expect(html).toContain("동화 내용");
    expect(html).toContain("story.png");
  });
});
