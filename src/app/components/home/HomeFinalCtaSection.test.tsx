import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import HomeFinalCtaSection from "@/app/components/home/HomeFinalCtaSection";

describe("HomeFinalCtaSection", () => {
  it("renders responsive CTA link to service", () => {
    const html = renderToStaticMarkup(createElement(HomeFinalCtaSection));

    expect(html).toContain('href="/service"');
    expect(html).toContain("동화 만들기 시작");
    expect(html).toContain("w-full sm:w-auto");
    expect(html).toContain("rounded-full bg-white");
  });
});
