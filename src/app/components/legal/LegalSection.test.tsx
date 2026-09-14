import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import LegalSection from "@/app/components/legal/LegalSection";

describe("LegalSection", () => {
  it("renders the section heading and content", () => {
    const html = renderToStaticMarkup(
      <LegalSection title="제1조 (목적)">
        <p>content</p>
      </LegalSection>,
    );
    ["제1조 (목적)", "content", "text-xl"].forEach(value =>
      expect(html).toContain(value),
    );
  });
});
