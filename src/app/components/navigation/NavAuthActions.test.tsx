import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import NavAuthActions from "@/app/components/navigation/NavAuthActions";

describe("NavAuthActions", () => {
  it("renders login CTA when unauthenticated", () => {
    const html = renderToStaticMarkup(
      createElement(NavAuthActions, {
        hasHydrated: true,
        userId: undefined,
        userEmail: undefined,
        onSignOut: () => {},
      }),
    );

    expect(html).toContain("로그인");
    expect(html).toContain("/sign-in");
  });

  it("renders profile and sign-out actions when authenticated", () => {
    const html = renderToStaticMarkup(
      createElement(NavAuthActions, {
        hasHydrated: true,
        userId: "user-1",
        userEmail: "test@example.com",
        onSignOut: () => {},
      }),
    );

    expect(html).toContain("test@example.com");
    expect(html).toContain("로그아웃");
    expect(html).toContain("/profile");
  });
});
