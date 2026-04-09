import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import LegalPageLayout from "@/app/components/legal/LegalPageLayout";

describe("LegalPageLayout", () => {
  it("renders title, children, footer, and mobile-first spacing classes", () => {
    const html = renderToStaticMarkup(
      createElement(
        LegalPageLayout,
        {
          title: "이용약관",
          footer: createElement("p", null, "footer"),
        },
        createElement("p", null, "body"),
      ),
    );

    expect(html).toContain("이용약관");
    expect(html).toContain("body");
    expect(html).toContain("footer");
    expect(html).toContain("px-4");
    expect(html).toContain("sm:px-6");
  });
});
