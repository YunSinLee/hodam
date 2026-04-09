import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import MyStoryThreadGrid from "@/app/components/my-story/MyStoryThreadGrid";
import type { ThreadWithUser } from "@/app/types/openai";

const THREADS: ThreadWithUser[] = [
  {
    id: 1,
    openai_thread_id: "thread_1",
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
        thread_id: 1,
        keyword: "모험",
      },
      {
        id: 2,
        thread_id: 1,
        keyword: "호랑이",
      },
    ],
  },
  {
    id: 2,
    openai_thread_id: "thread_2",
    created_at: "2026-04-09T01:00:00.000Z",
    user_id: "user-1",
    able_english: false,
    has_image: false,
    user: {
      id: "user-1",
      email: "user1@example.com",
      display_name: "유저1",
    },
    keywords: [
      {
        id: 3,
        thread_id: 2,
        keyword: "용기",
      },
    ],
  },
];

describe("MyStoryThreadGrid", () => {
  it("renders story cards for each thread", () => {
    const html = renderToStaticMarkup(
      createElement(MyStoryThreadGrid, { threads: THREADS }),
    );

    expect(html).toContain("/my-story/1");
    expect(html).toContain("/my-story/2");
    expect(html).toContain("모험, 호랑이");
    expect(html).toContain("용기");
    expect(html).toContain("영어 가능");
    expect(html).toContain("한국어만");
  });
});
