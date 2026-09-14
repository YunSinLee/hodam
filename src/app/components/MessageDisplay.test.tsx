import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import MessageDisplay from "@/app/components/MessageDisplay";

vi.mock("@/app/utils/session", () => ({ requireAccessToken: vi.fn() }));

describe("MessageDisplay", () => {
  it("renders accessible sentence controls with English when enabled", () => {
    const html = renderToStaticMarkup(
      createElement(MessageDisplay, {
        messages: [{ text: "옛날 옛적에", text_en: "Once upon a time" }],
        isShowEnglish: true,
        useGoogleTTS: false,
      }),
    );

    expect(html).toContain("옛날 옛적에");
    expect(html).toContain("Once upon a time");
    expect(html).toContain("읽어주기 설정 보기");
    expect(html).toContain('aria-label="1번째 문장 읽어주기"');
    expect(html).toContain('aria-label="1번째 영어 문장 읽어주기"');
    expect(html).toContain('aria-pressed="false"');
  });

  it("hides English content and its speech control when disabled", () => {
    const html = renderToStaticMarkup(
      createElement(MessageDisplay, {
        messages: [{ text: "호담 이야기", text_en: "Hodam story" }],
        isShowEnglish: false,
        useGoogleTTS: false,
      }),
    );

    expect(html).toContain("호담 이야기");
    expect(html).not.toContain("Hodam story");
    expect(html).not.toContain("영어 문장 읽어주기");
  });
});
