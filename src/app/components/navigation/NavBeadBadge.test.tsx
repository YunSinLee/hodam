import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import NavBeadBadge from "@/app/components/navigation/NavBeadBadge";

describe("NavBeadBadge", () => {
  it("renders bead count and bead link when count is provided", () => {
    const html = renderToStaticMarkup(
      createElement(NavBeadBadge, { count: 7 }),
    );

    expect(html).toContain('href="/bead"');
    expect(html).toContain("곶감");
    expect(html).toContain(">7<");
  });

  it("renders nothing when count is missing", () => {
    const html = renderToStaticMarkup(
      createElement(NavBeadBadge, { count: null }),
    );

    expect(html).toBe("");
  });
});
