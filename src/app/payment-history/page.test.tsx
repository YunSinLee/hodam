import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import PaymentHistoryPage from "@/app/payment-history/page";
import usePaymentHistoryPageController from "@/app/payment-history/usePaymentHistoryPageController";

vi.mock("@/app/payment-history/usePaymentHistoryPageController", () => ({
  default: vi.fn(),
}));

const mockUsePaymentHistoryPageController =
  usePaymentHistoryPageController as unknown as Mock;

describe("PaymentHistory page", () => {
  beforeEach(() => {
    mockUsePaymentHistoryPageController.mockReset();
  });

  it("renders loading state while payment history is fetching", () => {
    mockUsePaymentHistoryPageController.mockReturnValue({
      pageState: {
        isLoading: true,
        isAuthReady: false,
      },
      pageHandlers: {
        onBack: () => {},
      },
      errorState: null,
      errorHandlers: {
        onAction: () => {},
      },
      filterState: {
        filter: "all",
      },
      filterHandlers: {
        onFilterChange: () => {},
      },
      statsState: {
        totalAmount: 0,
        totalBeads: 0,
        totalCount: 0,
      },
      listState: {
        payments: [],
        filter: "all",
        selectedOrderId: null,
        timelineLoadingOrderId: null,
      },
      listHandlers: {
        onGoBead: () => {},
        onOpenTimeline: () => {},
      },
      timelinePanelState: {
        isOpen: false,
        isLoading: false,
        orderId: null,
        paymentFlowId: null,
        status: null,
        events: [],
        errorMessage: null,
      },
      timelinePanelHandlers: {
        onClose: () => {},
        onRetry: () => {},
      },
      formatters: {
        formatDate: () => "2026. 4. 7.",
        formatCurrency: (amount: number) => String(amount),
      },
    });

    const html = renderToStaticMarkup(createElement(PaymentHistoryPage));

    expect(html).toContain("결제 내역을 불러오는 중...");
  });

  it("renders summary and empty-list CTA when ready", () => {
    mockUsePaymentHistoryPageController.mockReturnValue({
      pageState: {
        isLoading: false,
        isAuthReady: true,
      },
      pageHandlers: {
        onBack: () => {},
      },
      errorState: {
        message: "일시적인 오류가 발생했습니다.",
        actionLabel: "다시 시도",
      },
      errorHandlers: {
        onAction: () => {},
      },
      filterState: {
        filter: "all",
      },
      filterHandlers: {
        onFilterChange: () => {},
      },
      statsState: {
        totalAmount: 12000,
        totalBeads: 20,
        totalCount: 2,
      },
      listState: {
        payments: [],
        filter: "all",
        selectedOrderId: null,
        timelineLoadingOrderId: null,
      },
      listHandlers: {
        onGoBead: () => {},
        onOpenTimeline: () => {},
      },
      timelinePanelState: {
        isOpen: false,
        isLoading: false,
        orderId: null,
        paymentFlowId: null,
        status: null,
        events: [],
        errorMessage: null,
      },
      timelinePanelHandlers: {
        onClose: () => {},
        onRetry: () => {},
      },
      formatters: {
        formatDate: () => "2026. 4. 7.",
        formatCurrency: (amount: number) => amount.toLocaleString("ko-KR"),
      },
    });

    const html = renderToStaticMarkup(createElement(PaymentHistoryPage));

    expect(html).toContain("결제 내역");
    expect(html).toContain("12,000원");
    expect(html).toContain("일시적인 오류가 발생했습니다.");
    expect(html).toContain("곶감 구매하기");
  });
});
