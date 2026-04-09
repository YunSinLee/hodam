import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import ServicePage from "@/app/service/page";
import useStoryPageController from "@/app/service/useStoryPageController";

vi.mock("@/app/service/useStoryPageController", () => ({
  default: vi.fn(),
}));

vi.mock("@/app/components/story/StoryPageStatusArea", () => ({
  default: () => createElement("div", null, "STORY_STATUS"),
}));

vi.mock("@/app/components/story/StoryAuthenticatedArea", () => ({
  default: () => createElement("div", null, "STORY_AUTHENTICATED"),
}));

vi.mock("@/app/components/GuideForSign", () => ({
  default: () => createElement("div", null, "GUIDE_FOR_SIGN"),
}));

const mockUseStoryPageController = useStoryPageController as unknown as Mock;

function createControllerValue(overrides: Record<string, unknown> = {}) {
  return {
    statusState: {
      hasHydrated: true,
      userId: "user-1",
      pageFeedback: null,
      pageFeedbackAction: null,
      ...(overrides.statusState as Record<string, unknown>),
    },
    authenticatedState: {
      neededBeadCount: 1,
      keywords: "",
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
      ...(overrides.authenticatedState as Record<string, unknown>),
    },
    handlers: {
      onKeywordsChange: () => {},
      onStartStory: () => {},
      onEnglishIncludedChange: () => {},
      onImageIncludedChange: () => {},
      onToggleEnglish: () => {},
      onTranslate: () => {},
      onSelectionClick: () => {},
      ...(overrides.handlers as Record<string, unknown>),
    },
    onFeedbackAction: () => {},
    ...(overrides.root as Record<string, unknown>),
  };
}

describe("service/page", () => {
  beforeEach(() => {
    mockUseStoryPageController.mockReset();
  });

  it("renders authenticated area when user is hydrated and signed in", () => {
    mockUseStoryPageController.mockReturnValue(createControllerValue());

    const html = renderToStaticMarkup(createElement(ServicePage));

    expect(html).toContain("STORY_STATUS");
    expect(html).toContain("STORY_AUTHENTICATED");
    expect(html).not.toContain("GUIDE_FOR_SIGN");
  });

  it("renders sign-in guide when hydrated without user", () => {
    mockUseStoryPageController.mockReturnValue(
      createControllerValue({
        statusState: {
          hasHydrated: true,
          userId: undefined,
        },
      }),
    );

    const html = renderToStaticMarkup(createElement(ServicePage));

    expect(html).toContain("STORY_STATUS");
    expect(html).toContain("GUIDE_FOR_SIGN");
    expect(html).not.toContain("STORY_AUTHENTICATED");
  });

  it("renders only status area while hydration is pending", () => {
    mockUseStoryPageController.mockReturnValue(
      createControllerValue({
        statusState: {
          hasHydrated: false,
          userId: undefined,
        },
      }),
    );

    const html = renderToStaticMarkup(createElement(ServicePage));

    expect(html).toContain("STORY_STATUS");
    expect(html).not.toContain("GUIDE_FOR_SIGN");
    expect(html).not.toContain("STORY_AUTHENTICATED");
  });
});
