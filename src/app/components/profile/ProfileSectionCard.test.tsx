import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import ProfileSectionCard from "@/app/components/profile/ProfileSectionCard";

describe("ProfileSectionCard", () => {
  it("renders title and action when action props are provided", () => {
    const html = renderToStaticMarkup(
      createElement(
        ProfileSectionCard,
        {
          title: "테스트 카드",
          actionLabel: "전체보기 →",
          onAction: vi.fn(),
        },
        createElement("p", null, "content"),
      ),
    );

    expect(html).toContain("테스트 카드");
    expect(html).toContain("전체보기 →");
    expect(html).toContain("content");
  });

  it("renders subtitle when no action is provided", () => {
    const html = renderToStaticMarkup(
      createElement(
        ProfileSectionCard,
        {
          title: "테스트 카드",
          subtitle: "subtext",
        },
        createElement("p", null, "content"),
      ),
    );

    expect(html).toContain("테스트 카드");
    expect(html).toContain("subtext");
  });
});
