// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("@/app/utils/session", () => ({ requireAccessToken: vi.fn() }));
import MessageDisplay from "../src/app/components/MessageDisplay";
const speak = vi.fn();
const messages = [
  { text: "첫 번째 이야기예요.", text_en: "First story." },
  { text: "두 번째 이야기예요.", text_en: "Second story." },
];
beforeEach(() => {
  vi.stubGlobal("speechSynthesis", {
    speak,
    cancel: vi.fn(),
    getVoices: () => [],
  });
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      constructor(public text: string) {}
    },
  );
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  speak.mockReset();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("exposes actual sentence buttons and ignores a cancelled sentence's delayed completion", () => {
  render(
    <MessageDisplay messages={messages} isShowEnglish useGoogleTTS={false} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "1번째 문장 읽어주기" }));
  const first = speak.mock.calls[0][0];
  fireEvent.click(screen.getByRole("button", { name: "2번째 문장 읽어주기" }));
  expect(speak.mock.calls[1][0].text).toBe(messages[1].text);
  act(() => first.onend());
  const current = screen.getByRole("button", {
    name: "2번째 문장 읽어주기 멈추기",
  });
  expect(current.getAttribute("aria-pressed")).toBe("true");
  expect(
    document.getElementById(current.getAttribute("aria-describedby")!)
      ?.textContent,
  ).toBe(messages[1].text);
  expect(
    screen.getByRole("button", { name: "1번째 영어 문장 읽어주기" }),
  ).toBeTruthy();
});
it("shows an inline explanation instead of throwing when speech is unavailable", () => {
  vi.stubGlobal("SpeechSynthesisUtterance", undefined);
  render(
    <MessageDisplay
      messages={messages}
      isShowEnglish={false}
      useGoogleTTS={false}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "1번째 문장 읽어주기" }));
  expect(screen.getByRole("status").textContent).toContain(
    "읽어주기를 사용할 수 없어요",
  );
  expect(speak).not.toHaveBeenCalled();
});
