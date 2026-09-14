import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import NavBrand from "@/app/components/navigation/NavBrand";

describe("NavBrand", () => {
  it("renders logo and brand text with home link", () => {
    const html = renderToStaticMarkup(createElement(NavBrand));

    expect(html).toContain("HODAM");
    expect(html).toContain("AI 동화 생성");
    expect(html).toContain('href="/"');
    expect(html).toContain("호담 로고");
  });
});
