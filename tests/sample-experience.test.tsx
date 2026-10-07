// @vitest-environment jsdom
import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

import SamplePage from "../src/app/sample/page";
import {
  consumeSampleStarter,
  prepareSampleStarter,
} from "../src/lib/picturebook/sample";

const gtag = vi.fn();
beforeEach(() => {
  sessionStorage.clear();
  gtag.mockClear();
  Object.assign(window, {
    gtag,
    matchMedia: () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
});
afterEach(() => {
  cleanup();
  consumeSampleStarter();
});

describe("sample to first book", () => {
  it("personalizes the story, preserves a selected ending, and records completion only at the end", () => {
    render(
      <StrictMode>
        <SamplePage />
      </StrictMode>,
    );
    expect(
      gtag.mock.calls.filter(call => call[1] === "hodam_sample_opened"),
    ).toHaveLength(1);
    fireEvent.change(screen.getByLabelText("우리 아이 별명으로 읽어볼까요?"), {
      target: { value: "보라" },
    });
    fireEvent.click(screen.getByRole("button", { name: "이 이름으로 읽기" }));
    expect(screen.getByText(/보라의 발끝이 멈췄어요/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "선택지로 가기" }));
    expect(screen.getByText("보라는 어떤 작은 용기를 내볼까요?")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: /B 엄마와 함께 한 걸음/ }),
    );
    expect(
      gtag.mock.calls.some(call => call[1] === "hodam_sample_completed"),
    ).toBe(false);
    fireEvent.keyDown(screen.getByRole("region", { name: "그림책 읽기" }), {
      key: "End",
    });
    expect(screen.getByText(/작은 용기를 내본 다음에는/)).toBeTruthy();
    expect(
      gtag.mock.calls.filter(call => call[1] === "hodam_sample_completed"),
    ).toHaveLength(1);
    fireEvent.change(screen.getByLabelText("우리 아이 별명으로 읽어볼까요?"), {
      target: { value: "하준" },
    });
    fireEvent.click(screen.getByRole("button", { name: "이 이름으로 읽기" }));
    fireEvent.keyDown(screen.getByRole("region", { name: "그림책 읽기" }), {
      key: "End",
    });
    expect(screen.getByText(/하준이는 작은 귀를 덮어주고/)).toBeTruthy();
    expect(
      gtag.mock.calls.filter(call => call[1] === "hodam_sample_personalized"),
    ).toHaveLength(1);
    expect(
      gtag.mock.calls.filter(call => call[1] === "hodam_sample_completed"),
    ).toHaveLength(1);
    expect(JSON.stringify(gtag.mock.calls)).not.toMatch(/보라|하준/);
    const link = screen.getByRole("link", { name: /우리 아이 그림책 만들기/ });
    expect(link.getAttribute("href")).toBe("/service");
    link.addEventListener("click", event => event.preventDefault());
    fireEvent.click(link);
    expect(consumeSampleStarter()?.childName).toBe("하준");
  });

  it("does not copy the fictional name into a real child's form", () => {
    prepareSampleStarter("이전 별명");
    render(<SamplePage />);
    fireEvent.click(screen.getByRole("button", { name: "이 이름으로 읽기" }));
    const link = screen.getByRole("link", { name: /우리 아이 그림책 만들기/ });
    link.addEventListener("click", event => event.preventDefault());
    fireEvent.click(link);
    expect(consumeSampleStarter()).toBeNull();
    expect(
      gtag.mock.calls.some(call => call[1] === "hodam_sample_personalized"),
    ).toBe(false);
  });

  it.each(["ctrlKey", "metaKey", "shiftKey", "altKey"])(
    "does not leave a nickname behind after a %s click",
    modifier => {
      render(<SamplePage />);
      fireEvent.change(
        screen.getByLabelText("우리 아이 별명으로 읽어볼까요?"),
        { target: { value: "보라" } },
      );
      fireEvent.click(screen.getByRole("button", { name: "이 이름으로 읽기" }));
      const link = screen.getByRole("link", {
        name: /우리 아이 그림책 만들기/,
      });
      link.addEventListener("click", event => event.preventDefault());
      fireEvent.click(link, { [modifier]: true });
      expect(consumeSampleStarter()).toBeNull();
      fireEvent.change(
        screen.getByLabelText("우리 아이 별명으로 읽어볼까요?"),
        { target: { value: "" } },
      );
      fireEvent.click(screen.getByRole("button", { name: "이 이름으로 읽기" }));
      fireEvent.click(link);
      expect(consumeSampleStarter()).toBeNull();
    },
  );
});
