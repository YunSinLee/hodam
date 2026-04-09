import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import useMessageDisplayTtsController from "@/app/components/message-display/useMessageDisplayTtsController";
import MessageDisplay from "@/app/components/MessageDisplay";

vi.mock(
  "@/app/components/message-display/useMessageDisplayTtsController",
  () => ({
    default: vi.fn(),
  }),
);

const mockUseMessageDisplayTtsController =
  useMessageDisplayTtsController as unknown as Mock;

describe("MessageDisplay", () => {
  beforeEach(() => {
    mockUseMessageDisplayTtsController.mockReset();
    mockUseMessageDisplayTtsController.mockReturnValue({
      state: {
        playingIndex: null,
        ttsErrorMessage: null,
        controls: {
          speed: 1,
          pitch: 1,
          showControls: false,
        },
      },
      handlers: {
        onToggleControls: () => {},
        onSpeedChange: () => {},
        onPitchChange: () => {},
        onSpeak: () => {},
        onStop: () => {},
      },
      audioRef: { current: null },
    });
  });

  it("renders message rows with english line when enabled", () => {
    const html = renderToStaticMarkup(
      createElement(MessageDisplay, {
        messages: [
          {
            text: "옛날 옛적에",
            text_en: "Once upon a time",
          },
        ],
        isShowEnglish: true,
      }),
    );

    expect(html).toContain("옛날 옛적에");
    expect(html).toContain("Once upon a time");
    expect(html).toContain("TTS 설정 보기");
  });

  it("hides english line when disabled", () => {
    const html = renderToStaticMarkup(
      createElement(MessageDisplay, {
        messages: [
          {
            text: "호담 이야기",
            text_en: "Hodam story",
          },
        ],
        isShowEnglish: false,
      }),
    );

    expect(html).toContain("호담 이야기");
    expect(html).not.toContain("Hodam story");
  });

  it("renders tts error banner when present", () => {
    mockUseMessageDisplayTtsController.mockReturnValue({
      state: {
        playingIndex: null,
        ttsErrorMessage: "오디오를 재생할 수 없습니다.",
        controls: {
          speed: 1,
          pitch: 1,
          showControls: false,
        },
      },
      handlers: {
        onToggleControls: () => {},
        onSpeedChange: () => {},
        onPitchChange: () => {},
        onSpeak: () => {},
        onStop: () => {},
      },
      audioRef: { current: null },
    });

    const html = renderToStaticMarkup(
      createElement(MessageDisplay, {
        messages: [{ text: "테스트", text_en: "" }],
        isShowEnglish: false,
      }),
    );

    expect(html).toContain("오디오를 재생할 수 없습니다.");
  });
});
