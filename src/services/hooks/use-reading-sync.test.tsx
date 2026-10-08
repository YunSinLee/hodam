// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import readingStateApi from "@/lib/client/api/reading-state";
import type { ReadingStateBook } from "@/lib/picturebook/reading-state";

import useReadingSync from "./use-reading-sync";

vi.mock("@/lib/client/api/reading-state", () => ({
  default: { list: vi.fn(), save: vi.fn() },
}));

describe("useReadingSync", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(readingStateApi.list)
      .mockReset()
      .mockResolvedValue({ books: [], nextCursor: null });
    vi.mocked(readingStateApi.save).mockReset();
  });
  afterEach(cleanup);

  it("does not request private data when no owner is signed in", () => {
    const { result } = renderHook(() => useReadingSync());
    expect(result.current.books).toEqual({});
    expect(result.current.setFavorite(11, true)).toBe(false);
    expect(readingStateApi.list).not.toHaveBeenCalled();
    expect(readingStateApi.save).not.toHaveBeenCalled();
  });

  it("isolates a late old-owner response and aborts it during an account change", async () => {
    let resolve!: (value: {
      books: ReadingStateBook[];
      nextCursor: null;
    }) => void;
    vi.mocked(readingStateApi.list).mockImplementationOnce(
      () =>
        new Promise(done => {
          resolve = done;
        }),
    );
    const { result, rerender } = renderHook(
      ({ owner }) => useReadingSync(owner),
      { initialProps: { owner: "hook-account-a" } },
    );
    const oldSignal = vi.mocked(readingStateApi.list).mock.calls[0][2];
    rerender({ owner: "hook-account-b" });
    expect(oldSignal?.aborted).toBe(true);
    expect(result.current.books).toEqual({});
    await waitFor(() => expect(result.current.status).toBe("synced"));
    await act(async () =>
      resolve({
        books: [
          {
            threadId: 11,
            favorite: true,
            favoriteVersion: 9,
            progress: null,
            progressVersion: 0,
          },
        ],
        nextCursor: null,
      }),
    );
    expect(result.current.books).toEqual({});
    expect(
      vi.mocked(readingStateApi.list).mock.calls.map(call => call[0]),
    ).toEqual(["hook-account-a", "hook-account-b"]);
  });

  it("deduplicates simultaneous reader and bookshelf subscriptions for one owner", async () => {
    const first = renderHook(() => useReadingSync("hook-shared-owner"));
    const second = renderHook(() => useReadingSync("hook-shared-owner"));
    await waitFor(() => expect(first.result.current.status).toBe("synced"));
    expect(second.result.current.status).toBe("synced");
    expect(readingStateApi.list).toHaveBeenCalledTimes(1);
    first.unmount();
    expect(vi.mocked(readingStateApi.list).mock.calls[0][2]?.aborted).toBe(
      false,
    );
  });
});
