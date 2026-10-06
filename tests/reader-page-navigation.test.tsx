// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PicturebookViewer from "../src/app/components/picturebook/PicturebookViewer";

import { book } from "./fixtures";

let desktop = false;
let resize: () => void;
const scrolledPages: Element[] = [];
const originalScroll = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "scrollIntoView",
);

beforeEach(() => {
  desktop = false;
  scrolledPages.length = 0;
  localStorage.clear();
  vi.stubGlobal("matchMedia", () => ({
    get matches() {
      return desktop;
    },
    addEventListener: (_event: string, handler: () => void) => {
      resize = handler;
    },
    removeEventListener: vi.fn(),
  }));
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: function (this: HTMLElement) {
      scrolledPages.push(this);
    },
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  if (originalScroll)
    Object.defineProperty(
      HTMLElement.prototype,
      "scrollIntoView",
      originalScroll,
    );
  else delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
});

describe("reading from the start after turning a page", () => {
  it.each([false, true])(
    "moves next and previous to the new page in desktop=%s mode",
    isDesktop => {
      desktop = isDesktop;
      render(<PicturebookViewer picturebook={book("complete")} />);
      expect(scrolledPages).toEqual([]);
      fireEvent.click(screen.getByRole("button", { name: "다음" }));
      const nextPage = screen.getByRole("article", {
        name: desktop ? "3쪽" : "2쪽",
      });
      expect(document.activeElement).toBe(nextPage);
      expect(scrolledPages).toEqual([nextPage]);
      fireEvent.click(screen.getByRole("button", { name: "이전" }));
      const firstPage = screen.getByRole("article", { name: "1쪽" });
      expect(document.activeElement).toBe(firstPage);
      expect(scrolledPages.at(-1)).toBe(firstPage);
    },
  );

  it("continues keyboard navigation from the focused page and respects boundaries", () => {
    render(<PicturebookViewer picturebook={book("complete")} />);
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    fireEvent.keyDown(document.activeElement!, { key: "End" });
    expect(document.activeElement).toBe(
      screen.getByRole("article", { name: "8쪽" }),
    );
    expect(scrolledPages).toHaveLength(2);
    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
    expect(scrolledPages).toHaveLength(2);
    fireEvent.keyDown(document.activeElement!, { key: "Home" });
    expect(document.activeElement).toBe(
      screen.getByRole("article", { name: "1쪽" }),
    );
    fireEvent.keyDown(document.activeElement!, { key: "ArrowLeft" });
    expect(scrolledPages).toHaveLength(3);
  });

  it("does not interrupt reading when text size, images or the screen size change", () => {
    const draft = book("complete");
    const { rerender } = render(<PicturebookViewer picturebook={draft} />);
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    scrolledPages.length = 0;
    fireEvent.click(screen.getByRole("button", { name: "큰 글씨" }));
    rerender(
      <PicturebookViewer
        picturebook={draft}
        imageUrls={{ 2: "https://example.com/page-2.png" }}
      />,
    );
    act(() => {
      desktop = true;
      resize();
    });
    expect(scrolledPages).toEqual([]);
    expect(screen.getByRole("button", { name: "기본 글씨" })).toBeTruthy();
  });

  it("still sends the choice jump and completed ending to their own headings", () => {
    const draft = book();
    const { rerender } = render(
      <PicturebookViewer picturebook={draft} onSelectChoice={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "선택지로 가기" }));
    const choice = screen.getByRole("heading", { name: draft.choice.promptKo });
    expect(document.activeElement).toBe(choice);
    expect(scrolledPages.at(-1)).toBe(choice);
    rerender(<PicturebookViewer picturebook={book("complete")} />);
    const title = screen.getByRole("heading", { name: draft.title });
    expect(document.activeElement).toBe(title);
    expect(scrolledPages.at(-1)).toBe(title);
    expect(screen.getByRole("article", { name: "5쪽" })).toBeTruthy();
  });
});
