import { describe, expect, it } from "vitest";

import {
  resolveNavBarAuthRedirect,
  resolveNavBarScrollState,
  shouldLoadNavBarBeadCount,
} from "@/app/components/navigation/nav-bar-controller-utils";

describe("resolveNavBarScrollState", () => {
  it("returns false when scroll offset is at threshold or below", () => {
    expect(resolveNavBarScrollState(0)).toBe(false);
    expect(resolveNavBarScrollState(10)).toBe(false);
  });

  it("returns true when scroll offset is above threshold", () => {
    expect(resolveNavBarScrollState(11)).toBe(true);
  });
});

describe("resolveNavBarAuthRedirect", () => {
  it("returns true only for signed-in event on auth pages with a session user", () => {
    expect(
      resolveNavBarAuthRedirect({
        event: "SIGNED_IN",
        hasSessionUser: true,
        pathname: "/sign-in",
      }),
    ).toBe(true);
  });

  it("returns false when event is not SIGNED_IN", () => {
    expect(
      resolveNavBarAuthRedirect({
        event: "SIGNED_OUT",
        hasSessionUser: true,
        pathname: "/sign-in",
      }),
    ).toBe(false);
  });

  it("returns false when there is no session user", () => {
    expect(
      resolveNavBarAuthRedirect({
        event: "SIGNED_IN",
        hasSessionUser: false,
        pathname: "/sign-in",
      }),
    ).toBe(false);
  });

  it("returns false on non-auth paths", () => {
    expect(
      resolveNavBarAuthRedirect({
        event: "SIGNED_IN",
        hasSessionUser: true,
        pathname: "/my-story",
      }),
    ).toBe(false);
  });
});

describe("shouldLoadNavBarBeadCount", () => {
  it("returns true when user id is a non-empty string", () => {
    expect(shouldLoadNavBarBeadCount("user-1")).toBe(true);
  });

  it("returns false when user id is missing or blank", () => {
    expect(shouldLoadNavBarBeadCount(undefined)).toBe(false);
    expect(shouldLoadNavBarBeadCount("")).toBe(false);
    expect(shouldLoadNavBarBeadCount("   ")).toBe(false);
  });
});
