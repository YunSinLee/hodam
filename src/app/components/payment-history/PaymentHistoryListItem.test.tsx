import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PaymentHistoryListItem from "@/app/components/payment-history/PaymentHistoryListItem";
import type { PaymentHistory } from "@/lib/client/api/payment";

const payment: PaymentHistory = {
  id: "payment-1",
  user_id: "user-1",
  order_id: "HODAM_ORDER_1",
  payment_key: "pay_key_1",
  amount: 2500,
  bead_quantity: 5,
  status: "completed",
  created_at: "2026-04-07T06:00:00.000Z",
  completed_at: "2026-04-07T06:01:00.000Z",
};

describe("PaymentHistoryListItem", () => {
  it("renders default timeline CTA when not selected/loading", () => {
    const html = renderToStaticMarkup(
      createElement(PaymentHistoryListItem, {
        payment,
        selectedOrderId: null,
        timelineLoadingOrderId: null,
        handlers: {
          onOpenTimeline: () => {},
        },
        formatters: {
          formatDate: () => "2026. 4. 7. 오후 3:00",
          formatCurrency: amount => amount.toLocaleString("ko-KR"),
        },
      }),
    );

    expect(html).toContain("상세 타임라인");
    expect(html).toContain("개당 500원");
    expect(html).toContain('aria-label="결제 HODAM_ORDER_1 타임라인 보기"');
    expect(html).toContain("w-full");
  });

  it("renders timeline state labels for selected/loading items", () => {
    const selectedHtml = renderToStaticMarkup(
      createElement(PaymentHistoryListItem, {
        payment,
        selectedOrderId: payment.order_id,
        timelineLoadingOrderId: null,
        handlers: {
          onOpenTimeline: () => {},
        },
        formatters: {
          formatDate: () => "2026. 4. 7. 오후 3:00",
          formatCurrency: amount => amount.toLocaleString("ko-KR"),
        },
      }),
    );

    expect(selectedHtml).toContain("타임라인 확인 중");

    const loadingHtml = renderToStaticMarkup(
      createElement(PaymentHistoryListItem, {
        payment,
        selectedOrderId: null,
        timelineLoadingOrderId: payment.order_id,
        handlers: {
          onOpenTimeline: () => {},
        },
        formatters: {
          formatDate: () => "2026. 4. 7. 오후 3:00",
          formatCurrency: amount => amount.toLocaleString("ko-KR"),
        },
      }),
    );

    expect(loadingHtml).toContain("불러오는 중...");
    expect(loadingHtml).toContain("disabled");
  });

  it("renders safe fallback when bead quantity is invalid", () => {
    const invalidPayment: PaymentHistory = {
      ...payment,
      bead_quantity: 0,
    };

    const html = renderToStaticMarkup(
      createElement(PaymentHistoryListItem, {
        payment: invalidPayment,
        selectedOrderId: null,
        timelineLoadingOrderId: null,
        handlers: {
          onOpenTimeline: () => {},
        },
        formatters: {
          formatDate: () => "2026. 4. 7. 오후 3:00",
          formatCurrency: amount => amount.toLocaleString("ko-KR"),
        },
      }),
    );

    expect(html).toContain("개당 정보 없음");
  });
});
