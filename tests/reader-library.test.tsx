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
import {
  getReadingLibrary,
  saveReadingProgress,
  setBookFavorite,
} from "../src/lib/client/reading-library";

import { book } from "./fixtures";

let desktop = false;
let resize: () => void;

vi.mock("../src/app/components/picturebook/ReadingFeedback", () => ({
  default: () => null,
}));

beforeEach(() => {
  desktop = false;
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
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("private reading preferences", () => {
  it("dismisses resume when a mobile bookmark belongs to the current desktop spread", () => {
    desktop = true;
    saveReadingProgress("owner-a", 17, {
      pageIndex: 1,
      pageCount: 8,
      completed: false,
    });
    render(
      <PicturebookViewer
        picturebook={book("complete")}
        readingOwnerId="owner-a"
        readingBookId={17}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "2쪽부터 이어 읽기" }));
    expect(
      screen.queryByRole("button", { name: "2쪽부터 이어 읽기" }),
    ).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole("article", { name: "1쪽" }),
    );
  });

  it("marks active reading complete when a larger viewport reveals the final page", () => {
    render(
      <PicturebookViewer
        picturebook={book("complete")}
        readingOwnerId="owner-a"
        readingBookId={17}
      />,
    );
    for (let page = 0; page < 6; page += 1)
      fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(
      getReadingLibrary("owner-a").books["17"].completedAt,
    ).toBeUndefined();
    act(() => {
      desktop = true;
      resize();
    });
    expect(
      getReadingLibrary("owner-a").books["17"].completedAt,
    ).toBeGreaterThan(0);
  });

  it("saves the start of the new ending after completing a choice", () => {
    const view = render(
      <PicturebookViewer
        picturebook={book()}
        readingOwnerId="owner-a"
        readingBookId={17}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "선택지로 가기" }));
    view.rerender(
      <PicturebookViewer
        picturebook={book("complete")}
        readingOwnerId="owner-a"
        readingBookId={17}
      />,
    );
    expect(getReadingLibrary("owner-a").books["17"]).toMatchObject({
      pageIndex: 4,
      pageCount: 8,
    });
  });
  it("offers the saved position without overwriting it on mount and remembers later navigation", () => {
    saveReadingProgress("owner-a", 17, {
      pageIndex: 3,
      pageCount: 8,
      completed: false,
    });
    render(
      <PicturebookViewer
        picturebook={book("complete")}
        readingOwnerId="owner-a"
        readingBookId={17}
      />,
    );
    expect(screen.getByRole("article", { name: "1쪽" })).toBeTruthy();
    expect(getReadingLibrary("owner-a").books["17"].pageIndex).toBe(3);
    fireEvent.click(screen.getByRole("button", { name: "4쪽부터 이어 읽기" }));
    expect(screen.getByRole("article", { name: "4쪽" })).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "4쪽부터 이어 읽기" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(getReadingLibrary("owner-a").books["17"].pageIndex).toBe(4);
    fireEvent.keyDown(screen.getByRole("region", { name: "그림책 읽기" }), {
      key: "End",
    });
    expect(
      getReadingLibrary("owner-a").books["17"].completedAt,
    ).toBeGreaterThan(0);
  });

  it("returns an unfinished four-page book to its choice page", () => {
    saveReadingProgress("owner-a", 17, {
      pageIndex: 3,
      pageCount: 4,
      completed: false,
    });
    render(
      <PicturebookViewer
        picturebook={book()}
        readingOwnerId="owner-a"
        readingBookId={17}
        onSelectChoice={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "4쪽부터 이어 읽기" }));
    expect(
      screen.getByRole("heading", { name: "어떻게 해볼까요?" }),
    ).toBeTruthy();
    expect(
      getReadingLibrary("owner-a").books["17"].completedAt,
    ).toBeUndefined();
  });

  it("does not display another owner's favorites or resume position when accounts change", () => {
    setBookFavorite("owner-a", 17, true);
    saveReadingProgress("owner-a", 17, {
      pageIndex: 2,
      pageCount: 8,
      completed: false,
    });
    const view = render(
      <PicturebookViewer
        picturebook={book("complete")}
        readingOwnerId="owner-a"
        readingBookId={17}
      />,
    );
    expect(
      screen
        .getByRole("button", { name: "좋아하는 책" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    view.rerender(
      <PicturebookViewer
        picturebook={book("complete")}
        readingOwnerId="owner-b"
        readingBookId={17}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "3쪽부터 이어 읽기" }),
    ).toBeNull();
    expect(
      screen
        .getByRole("button", { name: "좋아하는 책" })
        .getAttribute("aria-pressed"),
    ).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "좋아하는 책" }));
    expect(getReadingLibrary("owner-b").books["17"].favorite).toBe(true);
    expect(getReadingLibrary("owner-a").books["17"].pageIndex).toBe(2);
  });

  it("receives favorite updates without turning a page or replacing progress", () => {
    render(
      <PicturebookViewer
        picturebook={book("complete")}
        readingOwnerId="owner-a"
        readingBookId={17}
      />,
    );
    act(() => {
      setBookFavorite("owner-a", 17, true);
    });
    expect(
      screen
        .getByRole("button", { name: "좋아하는 책" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getByRole("article", { name: "1쪽" })).toBeTruthy();
  });

  it("continues reading when browser storage refuses writes", () => {
    render(
      <PicturebookViewer
        picturebook={book("complete")}
        readingOwnerId="owner-a"
        readingBookId={17}
      />,
    );
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(screen.getByRole("article", { name: "2쪽" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain(
      "읽던 위치를 저장하지 못했어요",
    );
    fireEvent.click(screen.getByRole("button", { name: "좋아하는 책" }));
    expect(
      screen
        .getByRole("button", { name: "좋아하는 책" })
        .getAttribute("aria-pressed"),
    ).toBe("false");
  });
});

it("remembers bedtime mode and removes the reading palette when leaving the reader", () => {
  const first = render(<PicturebookViewer picturebook={book()} />);
  fireEvent.click(screen.getByRole("button", { name: "잠자리 모드" }));
  expect(document.body.classList.contains("hodam-bedtime-mode")).toBe(true);
  first.unmount();
  expect(document.body.classList.contains("hodam-bedtime-mode")).toBe(false);
  render(<PicturebookViewer picturebook={book()} />);
  expect(
    screen
      .getByRole("button", { name: "잠자리 모드" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "잠자리 모드" }));
  expect(document.body.classList.contains("hodam-bedtime-mode")).toBe(false);
});
