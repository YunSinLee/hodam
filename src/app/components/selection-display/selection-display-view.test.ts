import { describe, expect, it } from "vitest";

import {
  getSelectionBadgeClass,
  getSelectionContainerClass,
  getSelectionEnglishTextClass,
  getSelectionTextClass,
  hasValidSelections,
  normalizeSelectionText,
} from "@/app/components/selection-display/selection-display-view";

describe("selection-display-view", () => {
  it("normalizes selection text safely", () => {
    expect(
      normalizeSelectionText({
        text: "  다음 선택  ",
        text_en: "Next",
      }),
    ).toBe("다음 선택");
    expect(
      normalizeSelectionText({
        text: "",
        text_en: "",
      }),
    ).toBe("");
  });

  it("detects whether valid selections exist", () => {
    expect(hasValidSelections([{ text: "선택", text_en: "choice" }])).toBe(
      true,
    );
    expect(hasValidSelections([{ text: "   ", text_en: "" }])).toBe(false);
  });

  it("returns style classes by selected/disabled state", () => {
    expect(getSelectionContainerClass(true, false)).toContain("bg-orange-100");
    expect(getSelectionContainerClass(false, true)).toContain("bg-gray-100");
    expect(getSelectionBadgeClass(false, false)).toContain("bg-orange-200");
    expect(getSelectionTextClass(true, false)).toContain("text-orange-800");
    expect(getSelectionEnglishTextClass(false, true)).toContain(
      "text-gray-400",
    );
  });
});
