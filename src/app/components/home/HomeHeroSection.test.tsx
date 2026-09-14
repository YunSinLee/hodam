import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import HomeHeroSection from "@/app/components/home/HomeHeroSection";

describe("HomeHeroSection", () => {
  it("renders mobile-first CTA and service link", () => {
    const html = renderToStaticMarkup(createElement(HomeHeroSection));

    expect(html).toContain('href="/service"');
    expect(html).toContain("지금 시작하기");
    expect(html).toContain("w-full sm:w-auto");
    expect(html).toContain("inline-flex max-w-full flex-wrap");
  });
});
