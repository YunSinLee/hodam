import { describe, expect, it } from "vitest";

import {
  isNavItemActive,
  primaryNavItems,
} from "@/app/components/navigation/nav-items";

describe("primaryNavItems", () => {
  it("keeps expected navigation order", () => {
    expect(primaryNavItems.map(item => item.href)).toEqual([
      "/",
      "/service",
      "/my-story",
    ]);
  });
});

describe("isNavItemActive", () => {
  it("marks exact path as active", () => {
    expect(isNavItemActive("/", "/")).toBe(true);
    expect(isNavItemActive("/service", "/service")).toBe(true);
  });

  it("marks story detail paths as active for my-story menu", () => {
    expect(isNavItemActive("/my-story", "/my-story")).toBe(true);
    expect(isNavItemActive("/my-story/123", "/my-story")).toBe(true);
  });

  it("returns false for unrelated paths", () => {
    expect(isNavItemActive("/profile", "/my-story")).toBe(false);
    expect(isNavItemActive(null, "/service")).toBe(false);
  });
});
