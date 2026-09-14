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
import PicturebookPage from "../src/app/components/picturebook/PicturebookPage";
import PicturebookViewer from "../src/app/components/picturebook/PicturebookViewer";
import SamplePage from "../src/app/sample/page";
import {
  parsePicturebookDraft,
  validatePicturebookInput,
} from "../src/app/utils/picturebook";

import { book, input } from "./fixtures";

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("reading position and focus", () => {
  it("opens a completed saved book at the beginning", () => {
    const saved = { ...book("complete"), selectedChoiceId: "B" as const };
    render(<PicturebookViewer picturebook={saved} selectedChoiceId="B" />);
    expect(screen.getByRole("article", { name: "1쪽" })).toBeTruthy();
    expect(screen.queryByRole("article", { name: "5쪽" })).toBeNull();
  });

  it("moves focus to choices and to the newly completed ending", () => {
    const draft = book();
    const { rerender } = render(
      <PicturebookViewer picturebook={draft} onSelectChoice={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "선택지로 가기" }));
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: draft.choice.promptKo }),
    );
    rerender(
      <PicturebookViewer picturebook={book("complete")} selectedChoiceId="A" />,
    );
    expect(screen.getByRole("article", { name: "5쪽" })).toBeTruthy();
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: draft.title }),
    );
  });

  it("keeps the chosen action visible while the ending is being prepared", () => {
    const draft = book();
    const select = vi.fn();
    const { rerender } = render(
      <PicturebookViewer picturebook={draft} onSelectChoice={select} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "선택지로 가기" }));
    fireEvent.click(screen.getByRole("button", { name: /B 엄마/ }));
    rerender(
      <PicturebookViewer
        picturebook={draft}
        onSelectChoice={select}
        isEndingLoading
      />,
    );
    expect(
      screen
        .getByRole("button", { name: /B 엄마/ })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /A 친구/ }));
    expect(select).toHaveBeenCalledExactlyOnceWith("B");
  });

  it("supports page keys within the reader without intercepting choice buttons", () => {
    render(<PicturebookViewer picturebook={book()} onSelectChoice={vi.fn()} />);
    const reader = screen.getByRole("region", { name: "그림책 읽기" });
    fireEvent.keyDown(reader, { key: "ArrowRight" });
    expect(screen.getByRole("article", { name: "2쪽" })).toBeTruthy();
    fireEvent.keyDown(reader, { key: "End" });
    expect(screen.getByRole("article", { name: "4쪽" })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("button", { name: /A 친구/ }), {
      key: "ArrowLeft",
    });
    expect(screen.getByRole("article", { name: "4쪽" })).toBeTruthy();
    fireEvent.keyDown(reader, { key: "Home" });
    expect(screen.getByRole("article", { name: "1쪽" })).toBeTruthy();
    fireEvent.keyDown(reader, { key: "ArrowLeft" });
    expect(screen.getByRole("article", { name: "1쪽" })).toBeTruthy();
  });

  it("keeps large text through the sample ending and resets to the first page", () => {
    render(<SamplePage />);
    fireEvent.click(screen.getByRole("button", { name: "큰 글씨" }));
    fireEvent.click(screen.getByRole("button", { name: "선택지로 가기" }));
    fireEvent.click(screen.getByRole("button", { name: /A 친구/ }));
    expect(screen.getByRole("article", { name: "5쪽" })).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "기본 글씨" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.keyDown(screen.getByRole("region", { name: "그림책 읽기" }), {
      key: "End",
    });
    fireEvent.click(screen.getByRole("button", { name: "처음부터 다시 읽기" }));
    expect(screen.getByRole("article", { name: "1쪽" })).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "기본 글씨" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "작은 용기를 빌려줄게" }),
    );
  });

  it("remembers text size across reader visits and works without storage access", () => {
    const first = render(<PicturebookViewer picturebook={book()} />);
    fireEvent.click(screen.getByRole("button", { name: "큰 글씨" }));
    first.unmount();
    const second = render(<PicturebookViewer picturebook={book()} />);
    expect(screen.getByRole("button", { name: "기본 글씨" })).toBeTruthy();
    second.unmount();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Blocked");
    });
    render(<PicturebookViewer picturebook={book()} />);
    fireEvent.click(screen.getByRole("button", { name: "큰 글씨" }));
    expect(screen.getByRole("button", { name: "기본 글씨" })).toBeTruthy();
  });
});

class TestUtterance {
  lang = "";
  rate = 1;
  onend?: () => void;
  onerror?: (event: { error: string }) => void;
  constructor(public text: string) {}
}

describe("browser read-aloud", () => {
  it("hides read-aloud when the browser lacks an utterance constructor", () => {
    vi.stubGlobal("speechSynthesis", { speak: vi.fn(), cancel: vi.fn() });
    vi.stubGlobal("SpeechSynthesisUtterance", undefined);
    render(<PicturebookViewer picturebook={book()} />);
    expect(screen.queryByRole("button", { name: "이 쪽 읽어주기" })).toBeNull();
  });

  it("ignores late cancellation events from the previous page", () => {
    const speak = vi.fn();
    const cancel = vi.fn();
    vi.stubGlobal("speechSynthesis", { speak, cancel });
    vi.stubGlobal("SpeechSynthesisUtterance", TestUtterance);
    const result = render(<PicturebookViewer picturebook={book()} />);
    fireEvent.click(screen.getByRole("button", { name: "이 쪽 읽어주기" }));
    const previous = speak.mock.calls[0][0] as TestUtterance;
    expect(previous.text).toContain("1쪽 이야기");
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    fireEvent.click(screen.getByRole("button", { name: "이 쪽 읽어주기" }));
    const current = speak.mock.calls[1][0] as TestUtterance;
    expect(current.text).toContain("2쪽 이야기");
    act(() => previous.onerror?.({ error: "interrupted" }));
    expect(
      screen
        .getByRole("button", { name: "읽어주기 멈추기" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    act(() => current.onend?.());
    expect(screen.getByRole("button", { name: "이 쪽 읽어주기" })).toBeTruthy();
    cancel.mockClear();
    result.unmount();
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("recovers the control if the browser refuses speech playback", () => {
    vi.stubGlobal("speechSynthesis", {
      speak: vi.fn(() => {
        throw new Error("Unavailable");
      }),
      cancel: vi.fn(),
    });
    vi.stubGlobal("SpeechSynthesisUtterance", TestUtterance);
    render(<PicturebookViewer picturebook={book()} />);
    fireEvent.click(screen.getByRole("button", { name: "이 쪽 읽어주기" }));
    expect(
      screen.getByText("이 기기에서 소리를 재생하지 못했어요."),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "이 쪽 읽어주기" })
        .getAttribute("aria-pressed"),
    ).toBe("false");
  });
});

describe("unavailable illustrations", () => {
  it("replaces a failed image with readable feedback and a retry", () => {
    const page = book().pages[0];
    render(
      <PicturebookPage page={page} imageUrl="https://example.com/page.png" />,
    );
    fireEvent.error(screen.getByRole("img"));
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText(page.textKo)).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain(
      "그림을 불러오지 못했어요",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "1쪽 그림 다시 불러오기" }),
    );
    expect(screen.getByRole("img")).toBeTruthy();
  });

  it("reports failed URLs to the image cache and accepts a refreshed URL", () => {
    const invalidate = vi.fn();
    const draft = book();
    const result = render(
      <PicturebookViewer
        picturebook={draft}
        imageUrls={{ 1: "https://example.com/expired.png" }}
        onImageError={invalidate}
      />,
    );
    fireEvent.error(screen.getByRole("img"));
    expect(invalidate).toHaveBeenCalledExactlyOnceWith(1);
    result.rerender(
      <PicturebookViewer
        picturebook={draft}
        imageUrls={{ 1: null }}
        onImageError={invalidate}
      />,
    );
    expect(
      screen.getByText("그림을 불러오지 못했어요. 글은 계속 읽을 수 있어요."),
    ).toBeTruthy();
    result.rerender(
      <PicturebookViewer
        picturebook={draft}
        imageUrls={{ 1: "https://example.com/refreshed.png" }}
        onImageError={invalidate}
      />,
    );
    expect(screen.getByRole("img").getAttribute("src")).toBe(
      "https://example.com/refreshed.png",
    );
  });
});

describe("creation input guards", () => {
  it.each([
    { isLoading: true, isAuthReady: true },
    { isLoading: false, isAuthReady: false },
  ])(
    "guards form submission while busy or resolving authentication: %o",
    state => {
      const submit = vi.fn();
      const result = render(
        <PicturebookInputForm
          value={input}
          picturebookCost={1}
          {...state}
          onChange={vi.fn()}
          onSubmit={submit}
        />,
      );
      fireEvent.submit(result.container.querySelector("form")!);
      expect(submit).not.toHaveBeenCalled();
      if (state.isLoading)
        expect(
          (screen.getByLabelText("이름 또는 별명") as HTMLInputElement)
            .disabled,
        ).toBe(true);
    },
  );

  it("associates form help with its inputs and uses distinct ids for each form", () => {
    render(
      <>
        <PicturebookInputForm
          value={input}
          picturebookCost={1}
          isLoading={false}
          onChange={vi.fn()}
          onSubmit={vi.fn()}
        />
        <PicturebookInputForm
          value={input}
          picturebookCost={1}
          isLoading={false}
          onChange={vi.fn()}
          onSubmit={vi.fn()}
        />
      </>,
    );
    const inputs = screen.getAllByLabelText("오늘 있었던 일");
    const ids = inputs.map(
      element => element.getAttribute("aria-describedby")!,
    );
    expect(ids[0]).not.toBe(ids[1]);
    ids.forEach(id =>
      expect(document.getElementById(id)?.textContent).toContain("500자"),
    );
  });

  it("rejects saved choices without usable labels or valid selections", () => {
    const blankPrompt = book();
    blankPrompt.choice.promptKo = "  ";
    expect(parsePicturebookDraft(JSON.stringify(blankPrompt))).toBeNull();
    const blankLabel = book();
    blankLabel.choice.options[1].labelKo = "  ";
    expect(parsePicturebookDraft(JSON.stringify(blankLabel))).toBeNull();
    expect(
      parsePicturebookDraft(
        JSON.stringify({ ...book("complete"), selectedChoiceId: "Z" }),
      ),
    ).toBeNull();
    expect(
      validatePicturebookInput({ ...input, childName: ` ${"가".repeat(20)} ` }),
    ).not.toBeNull();
  });

  it("normalizes missing legacy safety notes and rejects malformed note arrays", () => {
    const legacy = { ...book(), safetyNotes: undefined };
    expect(parsePicturebookDraft(JSON.stringify(legacy))?.safetyNotes).toEqual(
      [],
    );
    for (const key of ["safetyNotes", "qualityNotes", "revisionNotes"]) {
      expect(
        parsePicturebookDraft(JSON.stringify({ ...book(), [key]: "note" })),
      ).toBeNull();
      expect(
        parsePicturebookDraft(JSON.stringify({ ...book(), [key]: [42] })),
      ).toBeNull();
    }
  });
});
