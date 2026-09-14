import { describe, expect, it } from "vitest";

import {
  HOME_FEATURE_ROTATION_INTERVAL_MS,
  getNextFeatureIndex,
} from "@/app/home/home-feature-rotation";

describe("home feature rotation", () => {
  it("keeps the rotation interval at 3 seconds", () => {
    expect(HOME_FEATURE_ROTATION_INTERVAL_MS).toBe(3000);
  });

  it("returns the next index within feature bounds", () => {
    expect(getNextFeatureIndex(0, 3)).toBe(1);
    expect(getNextFeatureIndex(1, 3)).toBe(2);
  });

  it("wraps back to the first index after the last feature", () => {
    expect(getNextFeatureIndex(2, 3)).toBe(0);
  });

  it("safely handles empty or invalid feature counts", () => {
    expect(getNextFeatureIndex(10, 0)).toBe(0);
    expect(getNextFeatureIndex(10, -1)).toBe(0);
    expect(getNextFeatureIndex(10, Number.NaN)).toBe(0);
  });

  it("normalizes invalid current index values", () => {
    expect(getNextFeatureIndex(Number.NaN, 3)).toBe(1);
    expect(getNextFeatureIndex(Number.POSITIVE_INFINITY, 3)).toBe(1);
  });
});
