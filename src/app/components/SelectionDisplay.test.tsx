import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import SelectionDisplay from "@/app/components/SelectionDisplay";

describe("SelectionDisplay", () => {
  it("renders options with english text when enabled", () => {
    const html = renderToStaticMarkup(
      createElement(SelectionDisplay, {
        selections: [
          { text: "산으로 간다", text_en: "Go to mountain" },
          { text: "강으로 간다", text_en: "Go to river" },
        ],
        onSelectionClick: () => {},
        isShowEnglish: true,
      }),
    );

    expect(html).toContain("산으로 간다");
    expect(html).toContain("Go to mountain");
    expect(html).toContain("강으로 간다");
  });

  it("renders selected loading card when continuing", () => {
    const html = renderToStaticMarkup(
      createElement(SelectionDisplay, {
        selections: [{ text: "동굴로 들어간다", text_en: "Enter cave" }],
        onSelectionClick: () => {},
        selectedChoice: "동굴로 들어간다",
        isSelectionLoading: true,
      }),
    );

    expect(html).toContain("동굴로 들어간다");
    expect(html).toContain("이야기를 생성하고 있습니다...");
  });

  it("renders empty message for invalid options", () => {
    const html = renderToStaticMarkup(
      createElement(SelectionDisplay, {
        selections: [{ text: "   ", text_en: "" }],
        onSelectionClick: () => {},
        emptyMessage: "선택지가 아직 없습니다.",
      }),
    );

    expect(html).toContain("선택지가 아직 없습니다.");
  });
});
