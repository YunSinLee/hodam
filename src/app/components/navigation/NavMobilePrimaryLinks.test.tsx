import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import NavMobilePrimaryLinks from "@/app/components/navigation/NavMobilePrimaryLinks";

describe("NavMobilePrimaryLinks", () => {
  it("renders all primary links and marks active link", () => {
    const html = renderToStaticMarkup(
      createElement(NavMobilePrimaryLinks, {
        pathname: "/my-story/11",
        onCloseMenu: () => {},
      }),
    );

    expect(html).toContain("홈");
    expect(html).toContain("시작하기");
    expect(html).toContain("내 동화");
    expect(html).toContain("bg-orange-100 text-orange-700");
  });
});
