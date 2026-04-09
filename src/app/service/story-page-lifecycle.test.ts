import { describe, expect, it } from "vitest";

import {
  toContinueStoryPendingState,
  toContinueStorySettledState,
  toStartStoryFailureState,
  toStartStoryPendingState,
  toStartStorySettledState,
  toTranslateStoryPendingState,
  toTranslateStorySettledState,
} from "@/app/service/story-page-lifecycle";

describe("story-page-lifecycle", () => {
  it("maps start-story pending state from options", () => {
    expect(toStartStoryPendingState({ includeImage: true })).toEqual({
      isStarted: true,
      isStoryLoading: true,
      isImageLoading: true,
    });
  });

  it("returns canonical start-story failure/settled states", () => {
    expect(toStartStoryFailureState()).toEqual({
      isStarted: false,
    });
    expect(toStartStorySettledState()).toEqual({
      isStoryLoading: false,
      isImageLoading: false,
    });
  });

  it("returns continue-story pending/settled states", () => {
    expect(toContinueStoryPendingState("숲으로 간다")).toEqual({
      isSelectionLoading: true,
      selectedChoice: "숲으로 간다",
      isStoryLoading: true,
      selections: [],
    });
    expect(toContinueStorySettledState()).toEqual({
      isStoryLoading: false,
      isSelectionLoading: false,
      selectedChoice: "",
    });
  });

  it("returns translate-story pending/settled states", () => {
    expect(toTranslateStoryPendingState()).toEqual({
      translationInProgress: true,
    });
    expect(toTranslateStorySettledState()).toEqual({
      translationInProgress: false,
    });
  });
});
