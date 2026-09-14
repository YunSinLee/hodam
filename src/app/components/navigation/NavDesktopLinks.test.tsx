import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import NavDesktopLinks from "@/app/components/navigation/NavDesktopLinks";

describe("NavDesktopLinks", () => {
  it("renders primary menu labels", () => {
    const html = renderToStaticMarkup(
      createElement(NavDesktopLinks, { pathname: "/" }),
    );

    expect(html).toContain("홈");
    expect(html).toContain("시작하기");
    expect(html).toContain("내 동화");
  });

  it("marks my-story as active for detail path", () => {
    const html = renderToStaticMarkup(
      createElement(NavDesktopLinks, { pathname: "/my-story/10" }),
    );

    expect(html).toContain("bg-orange-100 text-orange-700");
  });
});
