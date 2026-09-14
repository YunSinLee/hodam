import { describe, expect, it } from "vitest";

import { BEAD_PACKAGES, findBeadPackageById } from "@/lib/payments/packages";

describe("BEAD_PACKAGES", () => {
  it("returns package by id", () => {
    const pkg = findBeadPackageById("bead_10");

    expect(pkg).not.toBeNull();
    expect(pkg?.quantity).toBe(10);
    expect(pkg?.popular).toBe(true);
  });

  it("returns null for unknown id", () => {
    expect(findBeadPackageById("unknown")).toBeNull();
  });

  it("keeps exactly one popular package", () => {
    const popularCount = BEAD_PACKAGES.filter(pkg => pkg.popular).length;
    expect(popularCount).toBe(1);
  });
});
