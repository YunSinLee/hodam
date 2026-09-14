import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import StoryPageStatusArea from "@/app/components/story/StoryPageStatusArea";

describe("StoryPageStatusArea", () => {
  it("renders loading and feedback area snapshot", () => {
    const html = renderToStaticMarkup(
      createElement(StoryPageStatusArea, {
        state: {
          hasHydrated: false,
          userId: undefined,
          pageFeedback: {
            type: "error",
            message: "로그인이 필요합니다.",
            action: {
              type: "goSignIn",
              label: "로그인하기",
            },
          },
          pageFeedbackAction: {
            type: "goSignIn",
            label: "로그인하기",
          },
        },
        onFeedbackAction: () => {},
      }),
    );

    expect(html).toMatchInlineSnapshot(
      `"<div class="rounded-lg border px-4 py-3 text-sm border-red-200 bg-red-50 text-red-700 rounded-xl"><p>로그인이 필요합니다.</p><div class="mt-2"><button type="button" class="rounded border px-3 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 border-red-300 bg-white text-red-700 hover:bg-red-50 focus-visible:ring-red-300">로그인하기</button></div></div><div class="rounded-xl border p-4 border-orange-200 bg-orange-50"><div class="flex items-start gap-3"><div class="mt-0.5 h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent"></div><div><p class="font-medium text-orange-700">로그인 상태를 확인하는 중입니다...</p></div></div></div>"`,
    );
  });

  it("renders empty markup when hydrated and no feedback", () => {
    const html = renderToStaticMarkup(
      createElement(StoryPageStatusArea, {
        state: {
          hasHydrated: true,
          userId: "user-1",
          pageFeedback: null,
          pageFeedbackAction: null,
        },
        onFeedbackAction: () => {},
      }),
    );

    expect(html).toBe("");
  });
});
