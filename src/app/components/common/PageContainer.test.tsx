import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PageContainer from "@/app/components/common/PageContainer";

describe("PageContainer", () => {
  it("renders the default content and responsive width", () => {
    const html = renderToStaticMarkup(<PageContainer>CONTENT</PageContainer>);
    ["mx-auto", "max-w-6xl", "px-3", "sm:px-4", "CONTENT"].forEach(value =>
      expect(html).toContain(value),
    );
  });
  it("applies the selected width and custom classes", () => {
    const html = renderToStaticMarkup(
      <PageContainer width="sm" className="py-4 flex flex-col">
        CONTENT
      </PageContainer>,
    );
    ["max-w-2xl", "py-4", "flex", "flex-col"].forEach(value =>
      expect(html).toContain(value),
    );
  });
});
