import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ProfileActivityPanel from "@/app/components/profile/ProfileActivityPanel";
import type {
  ProfileActivityHandlers,
  ProfileActivityState,
  ProfileFormatters,
} from "@/app/profile/profile-page-contract";

const handlers: ProfileActivityHandlers = {
  onGoMyStory: () => {},
  onOpenStoryDetail: () => {},
  onGoService: () => {},
  onGoPaymentHistory: () => {},
  onGoBead: () => {},
};

const formatters: ProfileFormatters = {
  formatDate: () => "2026. 4. 7.",
  formatCurrency: amount => amount.toLocaleString("ko-KR"),
};

describe("ProfileActivityPanel", () => {
  it("renders empty-state CTAs for stories and payments", () => {
    const state: ProfileActivityState = {
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
    };

    const html = renderToStaticMarkup(
      createElement(ProfileActivityPanel, {
        state,
        handlers,
        formatters,
      }),
    );

    expect(html).toContain("운영 KPI (최근 14일)");
    expect(html).toContain("아직 생성한 동화가 없습니다.");
    expect(html).toContain("결제 내역이 없습니다.");
  });

  it("renders latest story and payment records", () => {
    const state: ProfileActivityState = {
      stats: {
        totalStories: 7,
        totalBeadsPurchased: 30,
        totalBeadsUsed: 18,
        totalPaymentAmount: 2500,
        joinDate: "2026-04-01",
      },
      kpiWarningMessage: "일부 KPI가 보조 경로로 조회되었습니다.",
      latestCostPerStory: 0.42,
      latestAuthCallbackSuccess: 12,
      latestAuthCallbackError: 3,
      latestAuthCallbackSuccessGoogle: 8,
      latestAuthCallbackSuccessKakao: 4,
      latestAuthCallbackErrorGoogle: 2,
      latestAuthCallbackErrorKakao: 1,
      latestD1Retention: 0.28,
      latestD7Retention: 0.1,
      retainedD1: true,
      retainedD7: false,
      recentStories: [
        {
          id: 101,
          created_at: "2026-04-07T00:00:00.000Z",
          able_english: true,
          has_image: false,
          keywords: [{ keyword: "숲속" }, { keyword: "토끼" }],
        },
      ],
      paymentHistory: [
        {
          id: "payment-1",
          bead_quantity: 5,
          amount: 2500,
          created_at: "2026-04-07T00:00:00.000Z",
          status: "completed",
        },
      ],
    };

    const html = renderToStaticMarkup(
      createElement(ProfileActivityPanel, {
        state,
        handlers,
        formatters,
      }),
    );

    expect(html).toContain("숲속, 토끼");
    expect(html).toContain("완료");
    expect(html).toContain("2,500원");
    expect(html).toContain("로그인 콜백 진단(일별)");
    expect(html).toContain("성공 12");
    expect(html).toContain("오류 3");
    expect(html).toContain("Google 성공/오류 8/2");
    expect(html).toContain("Kakao 성공/오류 4/1");
  });
});
