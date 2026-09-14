import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PrivacyPage from "@/app/privacy/page";

describe("PrivacyPage", () => {
  it("renders core privacy policy sections and contact footer", () => {
    const html = renderToStaticMarkup(createElement(PrivacyPage));

    expect(html).toContain("개인정보처리방침");
    expect(html).toContain("1. 개인정보의 처리목적");
    expect(html).toContain("5. 개인정보처리의 위탁");
    expect(html).toContain("10. 쿠키의 운영 및 거부");
    expect(html).toContain("dldbstls7777@naver.com");
  });
});
