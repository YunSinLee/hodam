import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import MyStoryPage from "@/app/my-story/page";
import useMyStoryPageController from "@/app/my-story/useMyStoryPageController";

vi.mock("@/app/my-story/useMyStoryPageController", () => ({
  default: vi.fn(),
}));

const mockUseMyStoryPageController =
  useMyStoryPageController as unknown as Mock;

describe("MyStory page", () => {
  beforeEach(() => {
    mockUseMyStoryPageController.mockReset();
  });

  it("renders loading skeleton while auth is resolving", () => {
    mockUseMyStoryPageController.mockReturnValue({
      pageState: {
        isLoading: true,
        isAuthReady: false,
        isPageLoaded: true,
        threads: [],
      },
      bannerState: {
        error: null,
        warningMessage: null,
      },
      handlers: {
        onErrorAction: () => {},
      },
    });

    const html = renderToStaticMarkup(createElement(MyStoryPage));

    expect(html).toContain("animate-pulse");
    expect(html).toContain("내 동화");
  });

  it("renders error/warning banners with empty-state CTA", () => {
    mockUseMyStoryPageController.mockReturnValue({
      pageState: {
        isLoading: false,
        isAuthReady: true,
        isPageLoaded: true,
        threads: [],
      },
      bannerState: {
        error: {
          message: "로그인이 필요합니다.",
          actionLabel: "다시 로그인",
        },
        warningMessage: "보조 경로로 조회되었습니다.",
      },
      handlers: {
        onErrorAction: () => {},
      },
    });

    const html = renderToStaticMarkup(createElement(MyStoryPage));

    expect(html).toContain("로그인이 필요합니다.");
    expect(html).toContain("보조 경로로 조회되었습니다.");
    expect(html).toContain("아직 만든 동화가 없어요");
    expect(html).toContain("새 동화 만들기");
  });

  it("renders thread grid when story threads exist", () => {
    mockUseMyStoryPageController.mockReturnValue({
      pageState: {
        isLoading: false,
        isAuthReady: true,
        isPageLoaded: true,
        threads: [
          {
            id: 101,
            openai_thread_id: "thread_101",
            created_at: "2026-04-09T00:00:00.000Z",
            user_id: "user-1",
            able_english: true,
            has_image: true,
            user: {
              id: "user-1",
              email: "user1@example.com",
              display_name: "유저1",
            },
            keywords: [
              {
                id: 1,
                thread_id: 101,
                keyword: "모험",
              },
            ],
          },
        ],
      },
      bannerState: {
        error: null,
        warningMessage: null,
      },
      handlers: {
        onErrorAction: () => {},
      },
    });

    const html = renderToStaticMarkup(createElement(MyStoryPage));

    expect(html).toContain("/my-story/101");
    expect(html).toContain("모험");
    expect(html).toContain("영어 가능");
  });
});
