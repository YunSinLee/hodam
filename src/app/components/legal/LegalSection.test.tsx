import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import LegalSection from "@/app/components/legal/LegalSection";

describe("LegalSection", () => {
  it("renders section heading and content", () => {
    const html = renderToStaticMarkup(
      createElement(
        LegalSection,
        {
          title: "제1조 (목적)",
        },
        createElement("p", null, "content"),
      ),
    );

    expect(html).toContain("제1조 (목적)");
    expect(html).toContain("content");
    expect(html).toContain("text-xl");
  });
});
