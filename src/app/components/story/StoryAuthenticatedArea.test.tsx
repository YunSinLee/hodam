import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import StoryAuthenticatedArea from "@/app/components/story/StoryAuthenticatedArea";

const handlers = {
  onKeywordsChange: () => {},
  onStartStory: () => {},
  onEnglishIncludedChange: () => {},
  onImageIncludedChange: () => {},
  onToggleEnglish: () => {},
  onTranslate: () => {},
  onSelectionClick: () => {},
};

describe("StoryAuthenticatedArea", () => {
  it("renders input-focused snapshot before story starts", () => {
    const html = renderToStaticMarkup(
      createElement(StoryAuthenticatedArea, {
        state: {
          neededBeadCount: 1,
          keywords: "숲속, 토끼",
          isEnglishIncluded: false,
          isImageIncluded: false,
          isStoryLoading: false,
          isImageLoading: false,
          isStarted: false,
          session: {
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
          },
        },
        handlers,
      }),
    );

    expect(html).toMatchInlineSnapshot(
      `"<div class="flex flex-col gap-4"><section class="rounded-2xl border border-orange-200 bg-white p-4 shadow-sm sm:p-5"><div class="mb-4"><h2 class="mb-2 text-lg font-bold text-orange-700 sm:text-xl">키워드로 동화 만들기</h2><p class="mb-2 text-sm text-gray-600" aria-live="polite">콤마(,)로 구분된 키워드를 입력하세요. 필요한 곶감: <span class="font-semibold text-orange-700">1</span>개</p><input type="text" class="w-full rounded-xl border border-orange-200 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="예: 숲속, 토끼, 마법, 모험" inputMode="text" autoComplete="off" value="숲속, 토끼"/></div><div class="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2"><label for="english-checkbox" class="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition border-orange-200 bg-white text-gray-700"><input type="checkbox" id="english-checkbox" class="w-4 h-4 text-orange-600"/>영어 번역 (+1 곶감)</label><label for="image-checkbox" class="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition border-orange-200 bg-white text-gray-700"><input type="checkbox" id="image-checkbox" class="w-4 h-4 text-orange-600"/>그림 생성 (+1 곶감)</label></div><button type="button" class="min-h-[44px] w-full rounded-xl px-4 py-2 font-medium transition-colors bg-orange-500 text-white hover:bg-orange-600">동화 만들기 시작</button></section></div>"`,
    );
  });

  it("renders session loading notice snapshot when started", () => {
    const html = renderToStaticMarkup(
      createElement(StoryAuthenticatedArea, {
        state: {
          neededBeadCount: 3,
          keywords: "숲속, 토끼",
          isEnglishIncluded: true,
          isImageIncluded: true,
          isStoryLoading: true,
          isImageLoading: true,
          isStarted: true,
          session: {
            isImageIncluded: true,
            images: [],
            isImageLoading: true,
            isStoryLoading: true,
            isSelectionLoading: false,
            messages: [],
            isEnglishIncluded: true,
            isShowEnglish: true,
            translationInProgress: false,
            notice: "",
            selections: [],
            selectedChoice: "",
          },
        },
        handlers,
      }),
    );

    expect(html).toContain("이미지 생성 중...");
    expect(html).toContain("첫 번째 동화를 생성하고 있습니다...");
  });
});
