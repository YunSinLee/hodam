import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PageContainer from "@/app/components/common/PageContainer";

describe("PageContainer", () => {
  it("renders default xl width classes", () => {
    const html = renderToStaticMarkup(
      createElement(PageContainer, null, "CONTENT"),
    );

    expect(html).toContain("mx-auto");
    expect(html).toContain("max-w-6xl");
    expect(html).toContain("px-3");
    expect(html).toContain("sm:px-4");
    expect(html).toContain("CONTENT");
  });

  it("applies selected width and custom classes", () => {
    const html = renderToStaticMarkup(
      createElement(
        PageContainer,
        { width: "sm", className: "py-4 flex flex-col" },
        "CONTENT",
      ),
    );

    expect(html).toContain("max-w-2xl");
    expect(html).toContain("py-4");
    expect(html).toContain("flex");
    expect(html).toContain("flex-col");
  });
});
