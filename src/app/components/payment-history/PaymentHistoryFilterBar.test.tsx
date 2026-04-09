import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PaymentHistoryFilterBar from "@/app/components/payment-history/PaymentHistoryFilterBar";

describe("PaymentHistoryFilterBar", () => {
  it("renders filter options and active aria-pressed state", () => {
    const html = renderToStaticMarkup(
      createElement(PaymentHistoryFilterBar, {
        state: {
          filter: "completed",
        },
        handlers: {
          onFilterChange: () => {},
        },
      }),
    );

    expect(html).toContain("전체");
    expect(html).toContain("완료");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("overflow-x-auto");
  });
});
