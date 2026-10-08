import { describe, expect, it } from "vitest";

import {
  paginatePdfLines,
  picturebookPdfFilename,
  wrapPdfText,
} from "./pdf-layout";

describe("PDF text layout", () => {
  it("wraps Korean and long words without losing characters or overflowing", () => {
    const text =
      "하늘이가 용기를 내어 친구에게 다가갔어요. supercalifragilistic 그리고 웃었어요.";
    const lines = wrapPdfText(text, 12, line => Array.from(line).length);
    expect(lines.every(line => Array.from(line).length <= 12)).toBe(true);
    expect(lines.join("").replaceAll(" ", "")).toBe(text.replaceAll(" ", ""));
  });

  it("keeps paragraph breaks and normalizes decomposed Korean", () => {
    expect(wrapPdfText("하늘\n\n이야기", 30, text => text.length)).toEqual([
      "하늘",
      "",
      "이야기",
    ]);
  });

  it("continues long body text instead of shrinking or clipping it", () => {
    const lines = Array.from({ length: 48 }, (_, index) => `line ${index}`);
    const pages = paginatePdfLines(lines, 6, 18);
    expect(pages.map(page => page.length)).toEqual([6, 18, 18, 6]);
    expect(pages.flat()).toEqual(lines);
  });

  it("uses a safe filename and distinguishes a text-only export", () => {
    expect(picturebookPdfFilename('../하늘: 이야기?"', true)).toBe(
      "..하늘 이야기.pdf",
    );
    expect(picturebookPdfFilename("/", false)).toBe("호담 그림책 (글만).pdf");
  });
});
