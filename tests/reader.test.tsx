// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PicturebookInputForm from "../src/app/components/picturebook/PicturebookInputForm";
import PicturebookViewer from "../src/app/components/picturebook/PicturebookViewer";

import { book, input } from "./fixtures";

let mediaChange: () => void;
let desktop: boolean;
beforeEach(() => {
  desktop = false;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({
      get matches() {
        return desktop;
      },
      addEventListener: (_event: string, callback: () => void) => {
        mediaChange = callback;
      },
      removeEventListener: vi.fn(),
    }),
  });
});
afterEach(cleanup);

describe("reader", () => {
  it("can navigate to choices and sends the actual selected choice once", () => {
    const select = vi.fn();
    render(<PicturebookViewer picturebook={book()} onSelectChoice={select} />);
    fireEvent.click(screen.getByRole("button", { name: "선택지로 가기" }));
    fireEvent.click(screen.getByRole("button", { name: /B 엄마 손/ }));
    expect(select).toHaveBeenCalledExactlyOnceWith("B");
  });
  it("does not skip the preceding page after a mobile-to-desktop resize", () => {
    render(<PicturebookViewer picturebook={book("complete")} />);
    for (let i = 0; i < 7; i++)
      fireEvent.click(screen.getByRole("button", { name: "다음" }));
    act(() => {
      desktop = true;
      mediaChange();
    });
    expect(screen.getByText("7–8 / 8쪽")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "다음" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
  it("offers a text download, not a broken public share URL", () => {
    desktop = true;
    render(<PicturebookViewer picturebook={book("complete")} />);
    for (let i = 0; i < 3; i++)
      fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(
      screen.getByRole("button", { name: "이야기 파일 저장" }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "공유하기" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "내 책 링크 복사" }),
    ).toBeNull();
  });
});
describe("creation form", () => {
  it("preserves the child's identity when applying a situation example", () => {
    const change = vi.fn();
    render(
      <PicturebookInputForm
        value={input}
        picturebookCost={1}
        isLoading={false}
        onChange={change}
        onSubmit={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "양치가 싫어요" }));
    expect(change.mock.calls[0][0]).toMatchObject({
      childName: input.childName,
      childAge: "5",
      situation: expect.stringContaining("양치"),
    });
  });
  it("explains the login step and prevents invalid input submission", () => {
    const submit = vi.fn();
    const { rerender } = render(
      <PicturebookInputForm
        value={input}
        picturebookCost={1}
        isLoading={false}
        isSignedIn={false}
        onChange={vi.fn()}
        onSubmit={submit}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "로그인하고 그림책 만들기" }),
    );
    expect(submit).toHaveBeenCalledOnce();
    rerender(
      <PicturebookInputForm
        value={{ ...input, childName: " " }}
        picturebookCost={1}
        isLoading={false}
        onChange={vi.fn()}
        onSubmit={submit}
      />,
    );
    expect(
      (
        screen.getByRole("button", {
          name: "오늘 밤 그림책 만들기",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});
