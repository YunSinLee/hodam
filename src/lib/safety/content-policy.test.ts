import { describe, expect, it } from "vitest";

import { detectBlockedTopic } from "@/lib/safety/content-policy";

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
