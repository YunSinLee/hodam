import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PaymentTimelineContent from "@/app/components/payment-history/PaymentTimelineContent";

const formatters = {
  formatDate: () => "2026. 4. 7. 오후 3:00",
};

describe("PaymentTimelineContent", () => {
  it("renders loading state", () => {
    const html = renderToStaticMarkup(
      createElement(PaymentTimelineContent, {
        state: {
          isLoading: true,
          orderId: "HODAM_ORDER_1",
          paymentFlowId: "order:HODAM_ORDER_1",
          events: [],
          errorMessage: null,
        },
        handlers: {
          onRetry: () => {},
        },
        formatters,
      }),
    );

    expect(html).toContain("결제 타임라인을 불러오는 중...");
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
  });

  it("renders error and retry action", () => {
    const html = renderToStaticMarkup(
      createElement(PaymentTimelineContent, {
        state: {
          isLoading: false,
          orderId: null,
          paymentFlowId: "order:HODAM_FLOW_ONLY",
          events: [],
          errorMessage: "결제 타임라인을 불러오지 못했습니다.",
        },
        handlers: {
          onRetry: () => {},
        },
        formatters,
      }),
    );

    expect(html).toContain("결제 타임라인을 불러오지 못했습니다.");
    expect(html).toContain("흐름ID 기준 조회 실패: order:HODAM_FLOW_ONLY");
    expect(html).toContain("다시 시도");
    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-label="결제 타임라인 다시 시도"');
  });

  it("renders empty state when no events exist", () => {
    const html = renderToStaticMarkup(
      createElement(PaymentTimelineContent, {
        state: {
          isLoading: false,
          orderId: "HODAM_ORDER_2",
          paymentFlowId: null,
          events: [],
          errorMessage: null,
        },
        handlers: {
          onRetry: () => {},
        },
        formatters,
      }),
    );

    expect(html).toContain("표시할 타임라인 이벤트가 없습니다.");
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
  });
});
