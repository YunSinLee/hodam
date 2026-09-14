import { describe, expect, it } from "vitest";

import { resolveNavMobileAuthMode } from "@/app/components/navigation/nav-mobile-auth-view";

describe("resolveNavMobileAuthMode", () => {
  it("returns loading while hydration is pending", () => {
    expect(
      resolveNavMobileAuthMode({
        hasHydrated: false,
        userId: undefined,
      }),
    ).toBe("loading");
  });

  it("returns authenticated for a non-empty user id", () => {
    expect(
      resolveNavMobileAuthMode({
        hasHydrated: true,
        userId: "user-1",
      }),
    ).toBe("authenticated");
  });

  it("returns guest when hydrated without a usable user id", () => {
    expect(
      resolveNavMobileAuthMode({
        hasHydrated: true,
        userId: undefined,
      }),
    ).toBe("guest");
    expect(
      resolveNavMobileAuthMode({
        hasHydrated: true,
        userId: "   ",
      }),
    ).toBe("guest");
  });
});
