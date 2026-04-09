import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PaymentSuccessResultCard from "@/app/components/payment-success/PaymentSuccessResultCard";

describe("PaymentSuccessResultCard", () => {
  it("renders payment history deep link with orderId and flowId", () => {
    const html = renderToStaticMarkup(
      createElement(PaymentSuccessResultCard, {
        paymentInfo: {
          orderId: "HODAM_ORDER_1",
          amount: 5000,
          paymentFlowId: "order:HODAM_ORDER_1",
        },
      }),
    );

    expect(html).toContain("결제 상세 내역");
    expect(html).toContain(
      "/payment-history?orderId=HODAM_ORDER_1&amp;flowId=order%3AHODAM_ORDER_1",
    );
  });

  it("renders fallback payment history link without query when payment is missing", () => {
    const html = renderToStaticMarkup(
      createElement(PaymentSuccessResultCard, {
        paymentInfo: null,
      }),
    );

    expect(html).toContain("결제 상세 내역");
    expect(html).toContain("/payment-history");
  });
});
