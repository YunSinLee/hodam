// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSampleBook } from "@/lib/picturebook/sample";

import PicturebookPdfButton from "./PicturebookPdfButton";

const download = vi.hoisted(() => vi.fn());
const sampleImageUrls = (choice: string) =>
  Object.fromEntries(
    Array.from({ length: 8 }, (_, index) => [
      index + 1,
      `/sample/little-courage/page-${index + 1}${index === 4 ? `-${choice.toLowerCase()}` : ""}.webp`,
    ]),
  );
vi.mock("@/lib/picturebook/pdf", () => ({ downloadPicturebookPdf: download }));

beforeEach(() => {
  download.mockReset();
  download.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("PDF save control", () => {
  it("requires an explicit text-only choice when illustrations are missing", async () => {
    render(
      <PicturebookPdfButton
        picturebook={createSampleBook("하늘", "A")}
        imageUrls={{}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "PDF 저장" }));
    expect(download).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toContain(
      "그림이 아직 없어요",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "그림 없이 글만 PDF로 저장" }),
    );
    await waitFor(() =>
      expect(download).toHaveBeenCalledWith(
        expect.objectContaining({ illustrated: false }),
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain("다운로드 목록"),
    );
  });

  it("downloads a completed illustrated book and blocks duplicate clicks", async () => {
    let finish: () => void = () => {};
    download.mockImplementation(
      () =>
        new Promise<void>(resolve => {
          finish = resolve;
        }),
    );
    render(
      <PicturebookPdfButton
        picturebook={createSampleBook("하늘", "A")}
        imageUrls={sampleImageUrls("A")}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "PDF 저장" }));
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    expect(
      (
        screen.getByRole("button", {
          name: "PDF 준비 중…",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "PDF 준비 중…" }));
    expect(download).toHaveBeenCalledTimes(1);
    finish();
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain("다운로드 목록"),
    );
  });

  it("offers a retry and explicit text-only export when a signed image cannot load", async () => {
    download.mockRejectedValue(
      Object.assign(new Error("그림을 불러오지 못했어요."), { code: "images" }),
    );
    render(
      <PicturebookPdfButton
        picturebook={createSampleBook("하늘", "A")}
        imageUrls={sampleImageUrls("A")}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "PDF 저장" }));
    await screen.findByRole("button", { name: "그림 없이 글만 PDF로 저장" });
    expect(screen.getByRole("status").textContent).toBe(
      "그림을 불러오지 못했어요.",
    );
    expect(
      (screen.getByRole("button", { name: "PDF 저장" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("aborts an export when switching books, without reporting an old success", async () => {
    download.mockImplementation(() => new Promise(() => {}));
    const { rerender } = render(
      <PicturebookPdfButton
        picturebook={createSampleBook("하늘", "A")}
        imageUrls={sampleImageUrls("A")}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "PDF 저장" }));
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    const signal = download.mock.calls[0][0].signal as AbortSignal;
    rerender(
      <PicturebookPdfButton
        picturebook={createSampleBook("바다", "B")}
        imageUrls={sampleImageUrls("B")}
      />,
    );
    expect(signal.aborted).toBe(true);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
