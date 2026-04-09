import { describe, expect, it } from "vitest";

import {
  appendStoryMessages,
  buildStartStoryKeywordsPayload,
  mergeTranslatedStoryMessages,
  toContinueStoryStatePatch,
  toStartStoryStatePatch,
  toTranslateStoryStatePatch,
} from "@/app/service/story-page-state";

describe("story-page-state", () => {
  it("buildStartStoryKeywordsPayload normalizes keywords into API payload", () => {
    expect(buildStartStoryKeywordsPayload(" 숲속, 토끼, ,마법, 토끼  ")).toBe(
      "숲속, 토끼, 마법",
    );
  });

  it("buildStartStoryKeywordsPayload returns null for invalid input", () => {
    expect(buildStartStoryKeywordsPayload(" , ,   ")).toBeNull();
  });

  it("appendStoryMessages appends incoming messages", () => {
    const current = [{ text: "A", text_en: "A-en" }];
    const incoming = [{ text: "B", text_en: "B-en" }];

    expect(appendStoryMessages(current, incoming)).toEqual([
      { text: "A", text_en: "A-en" },
      { text: "B", text_en: "B-en" },
    ]);
  });

  it("mergeTranslatedStoryMessages overlays english text only", () => {
    const current = [
      { text: "안녕", text_en: "" },
      { text: "토끼", text_en: "" },
    ];
    const translated = [{ text: "ignored", text_en: "hello" }];

    expect(mergeTranslatedStoryMessages(current, translated)).toEqual([
      { text: "안녕", text_en: "hello" },
      { text: "토끼", text_en: "" },
    ]);
  });

  it("toStartStoryStatePatch normalizes start response fields", () => {
    expect(
      toStartStoryStatePatch({
        threadId: 15,
        messages: [{ text: "시작", text_en: "" }],
        selections: [{ text: "계속", text_en: "" }],
        notice: "다음 선택",
        imageUrl: "https://example.com/image.png",
        includeEnglish: true,
        beadCount: 9,
      }),
    ).toEqual({
      threadId: 15,
      messages: [{ text: "시작", text_en: "" }],
      selections: [{ text: "계속", text_en: "" }],
      notice: "다음 선택",
      images: ["https://example.com/image.png"],
      shouldShowEnglish: true,
      beadCount: 9,
    });
  });

  it("toContinueStoryStatePatch keeps only incoming message delta and metadata", () => {
    expect(
      toContinueStoryStatePatch({
        messages: [{ text: "다음", text_en: "" }],
        selections: [{ text: "끝", text_en: "" }],
        notice: "계속 이어집니다.",
        beadCount: 7,
      }),
    ).toEqual({
      incomingMessages: [{ text: "다음", text_en: "" }],
      selections: [{ text: "끝", text_en: "" }],
      notice: "계속 이어집니다.",
      beadCount: 7,
    });
  });

  it("toTranslateStoryStatePatch returns canonical translation toggle fields", () => {
    expect(
      toTranslateStoryStatePatch({
        messages: [{ text: "토끼", text_en: "rabbit" }],
        beadCount: 5,
      }),
    ).toEqual({
      translatedMessages: [{ text: "토끼", text_en: "rabbit" }],
      beadCount: 5,
      isShowEnglish: true,
      isEnglishIncluded: true,
    });
  });
});
