import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PaymentHistoryTimelinePanel from "@/app/components/payment-history/PaymentHistoryTimelinePanel";
import type {
  PaymentHistoryFormatters,
  PaymentTimelinePanelHandlers,
  PaymentTimelinePanelState,
} from "@/app/payment-history/payment-history-contract";

const handlers: PaymentTimelinePanelHandlers = {
  onClose: () => {},
  onRetry: () => {},
};

const formatters: Pick<PaymentHistoryFormatters, "formatDate"> = {
  formatDate: () => "2026. 4. 7. 오후 3:00",
};

describe("PaymentHistoryTimelinePanel", () => {
  it("renders nothing when panel is closed", () => {
    const state: PaymentTimelinePanelState = {
      isOpen: false,
      isLoading: false,
      orderId: null,
      paymentFlowId: null,
      status: null,
      events: [],
      errorMessage: null,
    };

    const html = renderToStaticMarkup(
      createElement(PaymentHistoryTimelinePanel, {
        state,
        handlers,
        formatters,
      }),
    );

    expect(html).toBe("");
  });

  it("renders timeline events when data is available", () => {
    const state: PaymentTimelinePanelState = {
      isOpen: true,
      isLoading: false,
      orderId: "HODAM_ORDER_1",
      paymentFlowId: "order:HODAM_ORDER_1",
      status: "completed",
      errorMessage: null,
      events: [
        {
          type: "payment_created",
          source: "payment_history",
          timestamp: "2026-04-07T06:00:00.000Z",
        },
        {
          type: "webhook_received",
          source: "webhook_transmissions",
          timestamp: "2026-04-07T06:00:30.000Z",
          details: {
            eventType: "PAYMENT_STATUS_CHANGED",
            retriedCount: 0,
            transmissionId: "tx-1",
          },
        },
      ],
    };

    const html = renderToStaticMarkup(
      createElement(PaymentHistoryTimelinePanel, {
        state,
        handlers,
        formatters,
      }),
    );

    expect(html).toContain("결제 처리 타임라인");
    expect(html).toContain("HODAM_ORDER_1");
    expect(html).toContain('aria-label="결제 처리 타임라인 패널"');
    expect(html).toContain('aria-label="결제 타임라인 닫기"');
    expect(html).toContain("결제 생성");
    expect(html).toContain("웹훅 수신");
    expect(html).toContain("웹훅 1건");
    expect(html).toContain("재시도 누적 0회");
    expect(html).toContain("전체 이벤트 2건");
    expect(html).toContain("전송ID: tx-1");
    expect(html).not.toContain("완료 결제인데 웹훅 이벤트 없음");
    expect(html).not.toContain("웹훅 재시도 감지");
  });

  it("renders warning badges for missing webhook and retries", () => {
    const state: PaymentTimelinePanelState = {
      isOpen: true,
      isLoading: false,
      orderId: "HODAM_ORDER_3",
      paymentFlowId: "order:HODAM_ORDER_3",
      status: "completed",
      errorMessage: null,
      events: [
        {
          type: "payment_completed",
          source: "payment_history",
          timestamp: "2026-04-07T07:00:00.000Z",
        },
      ],
    };

    const html = renderToStaticMarkup(
      createElement(PaymentHistoryTimelinePanel, {
        state,
        handlers,
        formatters,
      }),
    );

    expect(html).toContain("완료 결제인데 웹훅 이벤트 없음");
    expect(html).not.toContain("웹훅 재시도 감지");

    const retryState: PaymentTimelinePanelState = {
      ...state,
      events: [
        ...state.events,
        {
          type: "webhook_received",
          source: "webhook_transmissions",
          timestamp: "2026-04-07T07:00:05.000Z",
          details: {
            retriedCount: 2,
          },
        },
      ],
    };

    const retryHtml = renderToStaticMarkup(
      createElement(PaymentHistoryTimelinePanel, {
        state: retryState,
        handlers,
        formatters,
      }),
    );

    expect(retryHtml).toContain("웹훅 재시도 감지");
  });

  it("renders error and retry UI", () => {
    const state: PaymentTimelinePanelState = {
      isOpen: true,
      isLoading: false,
      orderId: "HODAM_ORDER_2",
      paymentFlowId: null,
      status: "failed",
      events: [],
      errorMessage: "결제 타임라인을 불러오지 못했습니다.",
    };

    const html = renderToStaticMarkup(
      createElement(PaymentHistoryTimelinePanel, {
        state,
        handlers,
        formatters,
      }),
    );

    expect(html).toContain("결제 타임라인을 불러오지 못했습니다.");
    expect(html).toContain("다시 시도");
  });

  it("renders flow-id lookup error when order id is unresolved", () => {
    const state: PaymentTimelinePanelState = {
      isOpen: true,
      isLoading: false,
      orderId: null,
      paymentFlowId: "order:HODAM_FLOW_ONLY",
      status: null,
      events: [],
      errorMessage: "결제 타임라인을 불러오지 못했습니다.",
    };

    const html = renderToStaticMarkup(
      createElement(PaymentHistoryTimelinePanel, {
        state,
        handlers,
        formatters,
      }),
    );

    expect(html).toContain("주문번호: 확인 중");
    expect(html).toContain("흐름ID 기준 조회 실패: order:HODAM_FLOW_ONLY");
  });
});
