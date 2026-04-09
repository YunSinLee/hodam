import { describe, expect, it } from "vitest";

import {
  detectBlockedTopic,
  detectBlockedTopicInStoryOutput,
} from "@/lib/safety/content-policy";

describe("detectBlockedTopic", () => {
  it("returns null for safe text", () => {
    expect(detectBlockedTopic(["용기와 우정의 모험 이야기"])).toBeNull();
  });

  it("detects blocked korean topic", () => {
    expect(detectBlockedTopic(["살인 사건을 다룬 이야기"])).toBe("살인");
  });

  it("detects blocked english topic", () => {
    expect(detectBlockedTopic(["a story about suicide and fear"])).toBe(
      "suicide",
    );
  });
});

describe("detectBlockedTopicInStoryOutput", () => {
  it("returns null for safe story output", () => {
    expect(
      detectBlockedTopicInStoryOutput({
        notice: "따뜻한 모험의 시작",
        imagePrompt: "child-friendly forest scene",
        paragraphs: ["친구들과 함께 숲길을 걸었다."],
        choices: ["집으로 돌아간다"],
      }),
    ).toBeNull();
  });

  it("detects blocked topics across output fields", () => {
    expect(
      detectBlockedTopicInStoryOutput({
        notice: "다음 장면",
        paragraphs: ["주인공은 살인 사건을 목격했다."],
        choices: ["도망간다"],
      }),
    ).toBe("살인");
  });
});
