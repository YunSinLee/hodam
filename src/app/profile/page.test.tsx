import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import ProfilePage from "@/app/profile/page";
import useProfilePageController from "@/app/profile/useProfilePageController";

vi.mock("@/app/profile/useProfilePageController", () => ({
  default: vi.fn(),
}));

vi.mock("@/app/components/profile/ProfileLoadingState", () => ({
  default: () => createElement("div", null, "PROFILE_LOADING"),
}));

vi.mock("@/app/components/profile/ProfileNotFoundState", () => ({
  default: () => createElement("div", null, "PROFILE_NOT_FOUND"),
}));

vi.mock("@/app/components/profile/ProfilePageHeader", () => ({
  default: () => createElement("div", null, "PROFILE_HEADER"),
}));

vi.mock("@/app/components/profile/ProfileFeedbackBanner", () => ({
  default: () => createElement("div", null, "PROFILE_FEEDBACK"),
}));

vi.mock("@/app/components/profile/ProfileSidebar", () => ({
  default: () => createElement("div", null, "PROFILE_SIDEBAR"),
}));

vi.mock("@/app/components/profile/ProfileActivityPanel", () => ({
  default: () => createElement("div", null, "PROFILE_ACTIVITY"),
}));

vi.mock("@/app/components/profile/ProfileImageOptionsModal", () => ({
  default: () => createElement("div", null, "PROFILE_IMAGE_MODAL"),
}));

vi.mock("@/app/components/profile/ProfileConfirmModal", () => ({
  default: () => createElement("div", null, "PROFILE_CONFIRM_MODAL"),
}));

const mockUseProfilePageController =
  useProfilePageController as unknown as Mock;

function buildControllerValue(overrides: Record<string, unknown> = {}) {
  return {
    pageState: {
      isLoading: false,
      isAuthReady: true,
      profile: {
        id: "user-1",
      },
      pageFeedback: null,
      ...(overrides.pageState as Record<string, unknown>),
    },
    pageHandlers: {
      onGoHome: () => {},
      onGoSignIn: () => {},
      onRetryLoadProfile: () => {},
      onPageFeedbackAction: () => {},
      ...(overrides.pageHandlers as Record<string, unknown>),
    },
    sidebarState: {
      profile: {
        id: "user-1",
      },
      stats: null,
      beadCount: 0,
      isEditingNickname: false,
      newNickname: "",
      isUpdatingNickname: false,
      ...(overrides.sidebarState as Record<string, unknown>),
    },
    sidebarHandlers: {
      onOpenImageOptions: () => {},
      onStartNicknameEdit: () => {},
      onNicknameInputChange: () => {},
      onSubmitNicknameUpdate: () => {},
      onCancelNicknameEdit: () => {},
      onGoBead: () => {},
      onLogout: () => {},
      ...(overrides.sidebarHandlers as Record<string, unknown>),
    },
    activityState: {
      stats: null,
      kpiWarningMessage: null,
      latestCostPerStory: 0,
      latestAuthCallbackSuccess: 0,
      latestAuthCallbackError: 0,
      latestAuthCallbackSuccessGoogle: 0,
      latestAuthCallbackSuccessKakao: 0,
      latestAuthCallbackErrorGoogle: 0,
      latestAuthCallbackErrorKakao: 0,
      latestD1Retention: 0,
      latestD7Retention: 0,
      retainedD1: false,
      retainedD7: false,
      recentStories: [],
      paymentHistory: [],
      ...(overrides.activityState as Record<string, unknown>),
    },
    activityHandlers: {
      onGoMyStory: () => {},
      onOpenStoryDetail: () => {},
      onGoService: () => {},
      onGoPaymentHistory: () => {},
      onGoBead: () => {},
      ...(overrides.activityHandlers as Record<string, unknown>),
    },
    modalState: {
      showImageOptions: false,
      isUploadingImage: false,
      hasCustomProfileImage: false,
      confirmAction: null,
      ...(overrides.modalState as Record<string, unknown>),
    },
    modalHandlers: {
      onUploadImage: () => {},
      onRemoveImage: () => {},
      onCloseImageOptions: () => {},
      onCancelConfirmAction: () => {},
      onConfirmAction: () => {},
      ...(overrides.modalHandlers as Record<string, unknown>),
    },
    formatters: {
      formatDate: () => "2026. 4. 7.",
      formatCurrency: (amount: number) => amount.toLocaleString("ko-KR"),
      ...(overrides.formatters as Record<string, unknown>),
    },
  };
}

describe("ProfilePage", () => {
  beforeEach(() => {
    mockUseProfilePageController.mockReset();
  });

  it("renders loading state while auth/profile state is not ready", () => {
    mockUseProfilePageController.mockReturnValue(
      buildControllerValue({
        pageState: {
          isLoading: true,
          isAuthReady: false,
        },
      }),
    );

    const html = renderToStaticMarkup(createElement(ProfilePage));

    expect(html).toContain("PROFILE_LOADING");
    expect(html).not.toContain("PROFILE_HEADER");
  });

  it("renders not-found state when profile is missing", () => {
    mockUseProfilePageController.mockReturnValue(
      buildControllerValue({
        pageState: {
          profile: null,
        },
      }),
    );

    const html = renderToStaticMarkup(createElement(ProfilePage));

    expect(html).toContain("PROFILE_NOT_FOUND");
    expect(html).not.toContain("PROFILE_SIDEBAR");
  });

  it("renders main profile layout and conditionally visible modals", () => {
    mockUseProfilePageController.mockReturnValue(
      buildControllerValue({
        pageState: {
          pageFeedback: {
            type: "error",
            message: "프로필 로딩 실패",
            actionType: "retry",
            actionLabel: "다시 시도",
          },
        },
        modalState: {
          showImageOptions: true,
          confirmAction: "logout",
        },
      }),
    );

    const html = renderToStaticMarkup(createElement(ProfilePage));

    expect(html).toContain("PROFILE_HEADER");
    expect(html).toContain("PROFILE_FEEDBACK");
    expect(html).toContain("PROFILE_SIDEBAR");
    expect(html).toContain("PROFILE_ACTIVITY");
    expect(html).toContain("PROFILE_IMAGE_MODAL");
    expect(html).toContain("PROFILE_CONFIRM_MODAL");
  });
});
