import { describe, expect, it } from "vitest";

import {
  canRequestStoryContinue,
  canRequestStoryTranslate,
} from "@/app/service/story-page-flow";

describe("story-page-flow", () => {
  it("allows continue request only when loading flags are clear", () => {
    expect(
      canRequestStoryContinue({
        isStoryLoading: false,
        isSelectionLoading: false,
      }),
    ).toBe(true);
    expect(
      canRequestStoryContinue({
        isStoryLoading: true,
        isSelectionLoading: false,
      }),
    ).toBe(false);
    expect(
      canRequestStoryContinue({
        isStoryLoading: false,
        isSelectionLoading: true,
      }),
    ).toBe(false);
  });

  it("allows translate request only when story session is valid", () => {
    expect(
      canRequestStoryTranslate({
        isStarted: true,
        messageCount: 2,
        threadId: 12,
      }),
    ).toBe(true);
    expect(
      canRequestStoryTranslate({
        isStarted: false,
        messageCount: 2,
        threadId: 12,
      }),
    ).toBe(false);
    expect(
      canRequestStoryTranslate({
        isStarted: true,
        messageCount: 0,
        threadId: 12,
      }),
    ).toBe(false);
    expect(
      canRequestStoryTranslate({
        isStarted: true,
        messageCount: 2,
        threadId: null,
      }),
    ).toBe(false);
  });
});
