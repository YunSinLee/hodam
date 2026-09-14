import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PaymentTimelineStatusBadges from "@/app/components/payment-history/PaymentTimelineStatusBadges";

describe("PaymentTimelineStatusBadges", () => {
  it("renders summary badges", () => {
    const html = renderToStaticMarkup(
      createElement(PaymentTimelineStatusBadges, {
        webhookEventCount: 3,
        webhookRetryTotal: 1,
        eventCount: 5,
        hasMissingWebhookWarning: false,
        hasWebhookRetryWarning: true,
      }),
    );

    expect(html).toContain("웹훅 3건");
    expect(html).toContain("재시도 누적 1회");
    expect(html).toContain("전체 이벤트 5건");
    expect(html).toContain("웹훅 재시도 감지");
    expect(html).not.toContain("완료 결제인데 웹훅 이벤트 없음");
  });
});
