import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ProfileSidebar from "@/app/components/profile/ProfileSidebar";
import type {
  ProfileSidebarHandlers,
  ProfileSidebarState,
} from "@/app/profile/profile-page-contract";

const handlers: ProfileSidebarHandlers = {
  onOpenImageOptions: () => {},
  onStartNicknameEdit: () => {},
  onNicknameInputChange: () => {},
  onSubmitNicknameUpdate: () => {},
  onCancelNicknameEdit: () => {},
  onGoBead: () => {},
  onLogout: () => {},
};

describe("ProfileSidebar", () => {
  it("renders profile summary and account actions", () => {
    const state: ProfileSidebarState = {
      profile: {
        id: "user-1",
        email: "hodam@example.com",
        display_name: "호담",
        profileUrl: "",
        created_at: "2026-04-07T00:00:00.000Z",
        totalStories: 4,
        totalBeadsPurchased: 20,
        totalBeadsUsed: 12,
      },
      stats: {
        totalStories: 4,
        totalBeadsPurchased: 20,
        totalBeadsUsed: 12,
        totalPaymentAmount: 10000,
        joinDate: "2026-04-01",
      },
      beadCount: 8,
      isEditingNickname: false,
      newNickname: "",
      isUpdatingNickname: false,
    };

    const html = renderToStaticMarkup(
      createElement(ProfileSidebar, {
        state,
        handlers,
        formatters: {
          formatDate: () => "2026. 4. 7.",
        },
      }),
    );

    expect(html).toContain("호담");
    expect(html).toContain("보유 곶감");
    expect(html).toContain("곶감 충전하기");
    expect(html).toContain("로그아웃");
  });

  it("renders nickname editor when edit mode is enabled", () => {
    const state: ProfileSidebarState = {
      profile: {
        id: "user-1",
        email: "hodam@example.com",
        display_name: "호담",
        profileUrl: "",
        created_at: "2026-04-07T00:00:00.000Z",
        totalStories: 4,
        totalBeadsPurchased: 20,
        totalBeadsUsed: 12,
      },
      stats: null,
      beadCount: 8,
      isEditingNickname: true,
      newNickname: "새 닉네임",
      isUpdatingNickname: false,
    };

    const html = renderToStaticMarkup(
      createElement(ProfileSidebar, {
        state,
        handlers,
        formatters: {
          formatDate: () => "2026. 4. 7.",
        },
      }),
    );

    expect(html).toContain("닉네임을 입력하세요");
    expect(html).toContain("저장");
    expect(html).toContain("취소");
  });
});
