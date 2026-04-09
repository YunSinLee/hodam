import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import BeadPage from "@/app/bead/page";
import useBeadPageController from "@/app/bead/useBeadPageController";

vi.mock("@/app/bead/useBeadPageController", () => ({
  default: vi.fn(),
}));

const mockUseBeadPageController = useBeadPageController as unknown as Mock;

describe("Bead page", () => {
  beforeEach(() => {
    mockUseBeadPageController.mockReset();
  });

  it("renders hydration loading state before auth is ready", () => {
    mockUseBeadPageController.mockReturnValue({
      statusState: {
        hasHydrated: false,
        userId: undefined,
      },
      pageState: {
        tossClientKey: "",
        beadCount: 0,
        packages: [],
        isLoading: false,
        selectedPackageId: null,
        pageFeedback: null,
      },
      handlers: {
        onPurchase: () => {},
        onOpenPaymentHistory: () => {},
        onFeedbackAction: () => {},
      },
    });

    const html = renderToStaticMarkup(createElement(BeadPage));

    expect(html).toContain("로그인 상태를 확인하는 중...");
  });

  it("renders sign-in prompt when user is missing", () => {
    mockUseBeadPageController.mockReturnValue({
      statusState: {
        hasHydrated: true,
        userId: undefined,
      },
      pageState: {
        tossClientKey: "",
        beadCount: 0,
        packages: [],
        isLoading: false,
        selectedPackageId: null,
        pageFeedback: null,
      },
      handlers: {
        onPurchase: () => {},
        onOpenPaymentHistory: () => {},
        onFeedbackAction: () => {},
      },
    });

    const html = renderToStaticMarkup(createElement(BeadPage));

    expect(html).toContain("로그인이 필요합니다");
    expect(html).toContain("곶감 충전을 위해 먼저 로그인해주세요.");
  });

  it("renders package cards and payment history entrypoint", () => {
    mockUseBeadPageController.mockReturnValue({
      statusState: {
        hasHydrated: true,
        userId: "user-1",
      },
      pageState: {
        tossClientKey: "test_toss_key",
        beadCount: 12,
        packages: [
          {
            id: "bead_5",
            quantity: 5,
            price: 2500,
            originalPrice: 3000,
            discount: 16,
            popular: true,
            description: "첫 구매 추천",
          },
        ],
        isLoading: false,
        selectedPackageId: null,
        pageFeedback: {
          type: "success",
          message: "곶감 충전이 완료되었습니다.",
          actionLabel: undefined,
        },
      },
      handlers: {
        onPurchase: () => {},
        onOpenPaymentHistory: () => {},
        onFeedbackAction: () => {},
      },
    });

    const html = renderToStaticMarkup(createElement(BeadPage));

    expect(html).toContain("12개");
    expect(html).toContain("결제 내역 보기");
    expect(html).toContain("첫 구매 추천");
    expect(html).toContain("곶감 충전이 완료되었습니다.");
  });
});
