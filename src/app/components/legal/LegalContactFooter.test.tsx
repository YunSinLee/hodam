import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import LegalContactFooter from "@/app/components/legal/LegalContactFooter";

describe("LegalContactFooter", () => {
  it("renders effective date and contact email link", () => {
    const html = renderToStaticMarkup(
      createElement(LegalContactFooter, {
        effectiveDateText: "본 약관은 2024년 1월 1일부터 시행됩니다.",
        contactPrefixText: "문의사항이 있으시면",
      }),
    );

    expect(html).toContain("본 약관은 2024년 1월 1일부터 시행됩니다.");
    expect(html).toContain("문의사항이 있으시면");
    expect(html).toContain('href="mailto:dldbstls7777@naver.com"');
    expect(html).toContain("dldbstls7777@naver.com");
  });
});
