import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import LegalPageLayout from "@/app/components/legal/LegalPageLayout";

describe("LegalPageLayout", () => {
  it("renders the title, content, footer and responsive spacing", () => {
    const html = renderToStaticMarkup(
      <LegalPageLayout title="이용약관" footer={<p>footer</p>}>
        <p>body</p>
      </LegalPageLayout>,
    );
    ["이용약관", "body", "footer", "px-4", "sm:px-6"].forEach(value =>
      expect(html).toContain(value),
    );
  });
});
