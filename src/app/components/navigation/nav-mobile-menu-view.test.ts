import { describe, expect, it } from "vitest";

import {
  getNavMobileItemClass,
  getNavMobileMenuContainerClass,
  getNavUserInitial,
} from "@/app/components/navigation/nav-mobile-menu-view";

describe("nav-mobile-menu-view", () => {
  it("builds open and closed container classes", () => {
    expect(getNavMobileMenuContainerClass(true)).toContain("opacity-100");
    expect(getNavMobileMenuContainerClass(true)).toContain(
      "max-h-[calc(100vh-4rem)]",
    );
    expect(getNavMobileMenuContainerClass(false)).toContain("max-h-0");
    expect(getNavMobileMenuContainerClass(false)).toContain("opacity-0");
  });

  it("builds active and idle navigation item classes", () => {
    expect(getNavMobileItemClass(true)).toContain("bg-orange-100");
    expect(getNavMobileItemClass(false)).toContain("hover:bg-gray-50");
  });

  it("returns deterministic user initial", () => {
    expect(getNavUserInitial("test@example.com")).toBe("T");
    expect(getNavUserInitial("")).toBe("U");
    expect(getNavUserInitial(undefined)).toBe("U");
  });
});
