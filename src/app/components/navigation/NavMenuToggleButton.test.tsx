import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import NavMenuToggleButton from "@/app/components/navigation/NavMenuToggleButton";

describe("NavMenuToggleButton", () => {
  it("renders closed state attributes by default", () => {
    const html = renderToStaticMarkup(
      createElement(NavMenuToggleButton, {
        isOpen: false,
        onToggle: () => {},
      }),
    );

    expect(html).toContain('aria-label="메뉴 열기"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("rotate-45 translate-y-1.5");
  });

  it("renders open state attributes and icon classes", () => {
    const html = renderToStaticMarkup(
      createElement(NavMenuToggleButton, {
        isOpen: true,
        onToggle: () => {},
      }),
    );

    expect(html).toContain('aria-label="메뉴 닫기"');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain("rotate-45 translate-y-1.5");
    expect(html).toContain("opacity-0");
    expect(html).toContain("-rotate-45 -translate-y-1.5");
  });
});
