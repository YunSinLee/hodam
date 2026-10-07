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
  it("distinguishes a complete story from missing illustrations", () => {
    const { rerender } = render(
      <PicturebookViewer
        picturebook={book("complete")}
        imageUrls={{ 1: "/cover.webp" }}
        headingLevel={1}
      />,
    );
    fireEvent.keyDown(screen.getByRole("region", { name: "그림책 읽기" }), {
      key: "End",
    });
    expect(
      screen.getByRole("heading", { name: "이야기가 완성됐어요" }),
    ).toBeTruthy();
    expect(screen.getByText(/그림 1\/8장/)).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 1, name: "작은 용기" }),
    ).toBeTruthy();
    rerender(
      <PicturebookViewer
        picturebook={book("complete")}
        imageUrls={Object.fromEntries(
          Array.from({ length: 8 }, (_, i) => [i + 1, `/page-${i + 1}.webp`]),
        )}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "그림책이 완성됐어요" }),
    ).toBeTruthy();
  });
  it("shows dismissible feedback after downloading from the last page", () => {
    const createUrl = vi.fn(() => "blob:test");
    vi.stubGlobal("URL", {
      createObjectURL: createUrl,
      revokeObjectURL: vi.fn(),
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    render(<PicturebookViewer picturebook={book("complete")} />);
    fireEvent.keyDown(screen.getByRole("region", { name: "그림책 읽기" }), {
      key: "End",
    });
    fireEvent.click(
      screen.getByRole("button", { name: "이야기 글 저장 (.txt)" }),
    );
    expect(createUrl).toHaveBeenCalledOnce();
    expect(screen.getByRole("status").textContent).toBe(
      "이야기를 텍스트 파일로 저장했어요.",
    );
    fireEvent.click(screen.getByRole("button", { name: "알림 닫기" }));
    expect(screen.queryByText("이야기를 텍스트 파일로 저장했어요.")).toBeNull();
    click.mockRestore();
    vi.unstubAllGlobals();
  });
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
      screen.getByRole("button", { name: "이야기 글 저장 (.txt)" }),
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
