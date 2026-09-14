import { describe, expect, it } from "vitest";

import { toNumberLike, toPercentText } from "@/lib/ui/profile-metrics";

describe("toNumberLike", () => {
  it("returns finite numbers as-is", () => {
    expect(toNumberLike(12.3)).toBe(12.3);
  });

  it("parses numeric strings", () => {
    expect(toNumberLike("42")).toBe(42);
    expect(toNumberLike("3.14")).toBe(3.14);
  });

  it("returns 0 for invalid values", () => {
    expect(toNumberLike("abc")).toBe(0);
    expect(toNumberLike(undefined)).toBe(0);
    expect(toNumberLike(null)).toBe(0);
    expect(toNumberLike(Number.NaN)).toBe(0);
  });
});

describe("toPercentText", () => {
  it("formats ratio into percentage text", () => {
    expect(toPercentText(0)).toBe("0.0%");
    expect(toPercentText(0.1234)).toBe("12.3%");
    expect(toPercentText(1)).toBe("100.0%");
  });
});
