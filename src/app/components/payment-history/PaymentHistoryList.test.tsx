import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PaymentHistoryList from "@/app/components/payment-history/PaymentHistoryList";
import type {
  PaymentHistoryFormatters,
  PaymentHistoryListHandlers,
  PaymentHistoryListState,
} from "@/app/payment-history/payment-history-contract";

const handlers: PaymentHistoryListHandlers = {
  onGoBead: () => {},
  onOpenTimeline: () => {},
};

const formatters: PaymentHistoryFormatters = {
  formatDate: () => "2026. 4. 7. 오후 3:00",
  formatCurrency: amount => amount.toLocaleString("ko-KR"),
};

describe("PaymentHistoryList", () => {
  it("renders empty-state CTA when payment list is empty", () => {
    const state: PaymentHistoryListState = {
      payments: [],
      filter: "all",
      selectedOrderId: null,
      timelineLoadingOrderId: null,
    };

    const html = renderToStaticMarkup(
      createElement(PaymentHistoryList, {
        state,
        handlers,
        formatters,
      }),
    );

    expect(html).toContain("결제 내역이 없습니다");
    expect(html).toContain("곶감 구매하기");
  });

  it("renders status-specific empty-state title for filtered view", () => {
    const state: PaymentHistoryListState = {
      payments: [],
      filter: "completed",
      selectedOrderId: null,
      timelineLoadingOrderId: null,
    };

    const html = renderToStaticMarkup(
      createElement(PaymentHistoryList, {
        state,
        handlers,
        formatters,
      }),
    );

    expect(html).toContain("완료 내역이 없습니다");
  });

  it("renders payment rows and calculated unit price", () => {
    const state: PaymentHistoryListState = {
      filter: "all",
      selectedOrderId: null,
      timelineLoadingOrderId: null,
      payments: [
        {
          id: "payment-1",
          user_id: "user-1",
          order_id: "HODAM_ORDER_1",
          payment_key: "pay_key_1",
          amount: 2500,
          bead_quantity: 5,
          status: "completed",
          created_at: "2026-04-07T06:00:00.000Z",
          completed_at: "2026-04-07T06:01:00.000Z",
        },
      ],
    };

    const html = renderToStaticMarkup(
      createElement(PaymentHistoryList, {
        state,
        handlers,
        formatters,
      }),
    );

    expect(html).toContain("HODAM_ORDER_1");
    expect(html).toContain("2,500원");
    expect(html).toContain("개당");
    expect(html).toContain("500");
    expect(html).toContain("상세 타임라인");
  });
});
