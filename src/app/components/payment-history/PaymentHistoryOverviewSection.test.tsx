import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PaymentHistoryOverviewSection from "@/app/components/payment-history/PaymentHistoryOverviewSection";
import type {
  PaymentHistoryErrorHandlers,
  PaymentHistoryFilterHandlers,
  PaymentHistoryFormatters,
  PaymentHistoryPageHandlers,
} from "@/app/payment-history/payment-history-contract";

const pageHandlers: PaymentHistoryPageHandlers = {
  onBack: () => {},
};

const filterHandlers: PaymentHistoryFilterHandlers = {
  onFilterChange: () => {},
};

const errorHandlers: PaymentHistoryErrorHandlers = {
  onAction: () => {},
};

const formatters: PaymentHistoryFormatters = {
  formatDate: () => "2026. 4. 7.",
  formatCurrency: amount => amount.toLocaleString("ko-KR"),
};

describe("PaymentHistoryOverviewSection", () => {
  it("renders header/stats/filter and optional error banner", () => {
    const html = renderToStaticMarkup(
      createElement(PaymentHistoryOverviewSection, {
        pageHandlers,
        statsState: {
          totalAmount: 12000,
          totalBeads: 20,
          totalCount: 2,
        },
        filterState: {
          filter: "all",
        },
        filterHandlers,
        errorState: {
          message: "일시적인 오류가 발생했습니다.",
          actionLabel: "다시 시도",
        },
        errorHandlers,
        formatters,
      }),
    );

    expect(html).toContain("결제 내역");
    expect(html).toContain("12,000원");
    expect(html).toContain("전체");
    expect(html).toContain("일시적인 오류가 발생했습니다.");
  });

  it("does not render error banner when error state is null", () => {
    const html = renderToStaticMarkup(
      createElement(PaymentHistoryOverviewSection, {
        pageHandlers,
        statsState: {
          totalAmount: 0,
          totalBeads: 0,
          totalCount: 0,
        },
        filterState: {
          filter: "all",
        },
        filterHandlers,
        errorState: null,
        errorHandlers,
        formatters,
      }),
    );

    expect(html).not.toContain("일시적인 오류가 발생했습니다.");
  });
});
