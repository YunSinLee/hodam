// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ReadingFeedback from "./ReadingFeedback";

const api = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn() }));
vi.mock("@/lib/client/api/reading-feedback", () => ({ default: api }));

const saved = {
  rating: "again",
  reason: "story",
  updatedAt: "2026-10-08T00:00:00Z",
};
beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ feedback: null });
  api.save.mockResolvedValue({ feedback: saved });
});
afterEach(cleanup);

describe("ReadingFeedback", () => {
  it("saves only the bounded response and allows editing later", async () => {
    render(<ReadingFeedback threadId={752} ownerId="owner-1" />);
    fireEvent.click(
      await screen.findByRole("button", { name: "또 읽고 싶어요" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "이야기가 재미있어요" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "반응 남기기" }));
    const edit = await screen.findByRole("button", { name: "반응 바꾸기" });
    expect(api.save).toHaveBeenCalledWith(
      752,
      "owner-1",
      {
        rating: "again",
        reason: "story",
      },
      expect.any(AbortSignal),
    );
    expect(document.activeElement).toBe(edit);
    fireEvent.click(edit);
    expect(
      screen
        .getByRole("button", { name: "또 읽고 싶어요" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("does not require a reason and resets incompatible reasons on a rating change", async () => {
    render(<ReadingFeedback threadId={752} ownerId="owner-1" />);
    fireEvent.click(
      await screen.findByRole("button", { name: "조금 아쉬워요" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "문장이 어려워요" }));
    fireEvent.click(screen.getByRole("button", { name: "또 읽고 싶어요" }));
    fireEvent.click(screen.getByRole("button", { name: "반응 남기기" }));
    await screen.findByRole("button", { name: "반응 바꾸기" });
    expect(api.save.mock.calls[0][2]).toEqual({
      rating: "again",
      reason: null,
    });
  });

  it("shows retry without a false thank-you and keeps the selected response", async () => {
    api.save.mockRejectedValueOnce(new Error("storage unavailable"));
    render(<ReadingFeedback threadId={752} ownerId="owner-1" />);
    fireEvent.click(
      await screen.findByRole("button", { name: "또 읽고 싶어요" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "반응 남기기" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "아직 저장하지 못했어요",
    );
    expect(screen.queryByText("반응을 저장했어요. 고마워요!")).toBeNull();
    expect(
      screen
        .getByRole("button", { name: "또 읽고 싶어요" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "반응 남기기" }));
    await screen.findByRole("button", { name: "반응 바꾸기" });
    expect(api.save).toHaveBeenCalledTimes(2);
  });

  it("offers an explicit retry if initial loading fails", async () => {
    api.get.mockRejectedValueOnce(new Error("storage unavailable"));
    render(<ReadingFeedback threadId={752} ownerId="owner-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "다시 확인" }));
    await screen.findByRole("button", { name: "또 읽고 싶어요" });
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it("does not duplicate a pending submission", async () => {
    api.save.mockReturnValue(new Promise(() => {}));
    render(<ReadingFeedback threadId={752} ownerId="owner-1" />);
    fireEvent.click(
      await screen.findByRole("button", { name: "또 읽고 싶어요" }),
    );
    const submit = screen.getByRole("button", { name: "반응 남기기" });
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(api.save).toHaveBeenCalledTimes(1);
    expect(
      (
        screen.getByRole("button", {
          name: "반응 저장 중…",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("hides previous feedback immediately when the account or book changes", async () => {
    api.get.mockResolvedValueOnce({ feedback: saved });
    const { rerender } = render(
      <ReadingFeedback threadId={752} ownerId="owner-1" />,
    );
    await screen.findByRole("button", { name: "반응 바꾸기" });
    api.get.mockReturnValue(new Promise(() => {}));
    rerender(<ReadingFeedback threadId={753} ownerId="owner-2" />);
    expect(screen.queryByText("이야기가 재미있어요")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("확인하고 있어요");
    expect(api.get).toHaveBeenLastCalledWith(
      753,
      "owner-2",
      expect.any(AbortSignal),
    );
  });

  it("ignores and aborts a late save from a previous account", async () => {
    let resolveSave: (value: unknown) => void = () => {};
    api.save.mockReturnValue(
      new Promise(resolve => {
        resolveSave = resolve;
      }),
    );
    const { rerender } = render(
      <ReadingFeedback threadId={752} ownerId="owner-1" />,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "또 읽고 싶어요" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "반응 남기기" }));
    const signal = api.save.mock.calls[0][3] as AbortSignal;
    rerender(<ReadingFeedback threadId={752} ownerId="owner-2" />);
    expect(signal.aborted).toBe(true);
    await act(async () => {
      resolveSave({ feedback: saved });
    });
    await waitFor(() =>
      expect(screen.queryByText("반응을 저장했어요. 고마워요!")).toBeNull(),
    );
    expect(
      screen
        .getByRole("button", { name: "또 읽고 싶어요" })
        .getAttribute("aria-pressed"),
    ).toBe("false");
  });
});
