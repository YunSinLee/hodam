import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import MyStoryCard from "@/app/components/my-story/MyStoryCard";
import type { ThreadWithUser } from "@/app/types/openai";

const THREAD: ThreadWithUser = {
  id: 42,
  openai_thread_id: "thread_42",
  created_at: "2026-04-09T00:00:00.000Z",
  user_id: "user-42",
  able_english: true,
  has_image: false,
  user: {
    id: "user-42",
    email: "user42@example.com",
    display_name: "테스터",
  },
  keywords: [
    {
      id: 1,
      thread_id: 42,
      keyword: "달빛",
    },
  ],
};

describe("MyStoryCard", () => {
  it("renders thread metadata and animated card container", () => {
    const html = renderToStaticMarkup(
      createElement(MyStoryCard, { thread: THREAD, index: 2 }),
    );

    expect(html).toContain("/my-story/42");
    expect(html).toContain("달빛");
    expect(html).toContain("영어 가능");
    expect(html).toContain("이미지 없음");
    expect(html).toContain("hodam-fade-in-up");
    expect(html).toContain("animation-delay:0.16s");
  });
});
