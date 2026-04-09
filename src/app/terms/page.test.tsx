import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import TermsPage from "@/app/terms/page";

describe("TermsPage", () => {
  it("renders core terms sections and contact footer", () => {
    const html = renderToStaticMarkup(createElement(TermsPage));

    expect(html).toContain("이용약관");
    expect(html).toContain("제1조 (목적)");
    expect(html).toContain("제5조 (서비스 이용료)");
    expect(html).toContain("제10조 (분쟁해결)");
    expect(html).toContain("dldbstls7777@naver.com");
  });
});
