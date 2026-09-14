// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ draw: vi.fn(), token: vi.fn() }));
vi.mock("@/app/api/story-actions", () => ({
  drawPicturebookPageAction: mocks.draw,
}));
vi.mock("@/app/utils/session", () => ({ requireAccessToken: mocks.token }));

import usePicturebookImages from "../src/services/hooks/use-picturebook-images";
import useUserInfo from "../src/services/hooks/use-user-info";

import { book } from "./fixtures";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.resetAllMocks();
  useUserInfo.setState({
    userInfo: { id: "owner", email: "", profileUrl: "" },
  });
  mocks.token.mockResolvedValue("token");
  mocks.draw.mockImplementation(async (_id: number, page: number) => ({
    ok: true,
    url: `image-${page}`,
  }));
});
afterEach(cleanup);

describe("picturebook image queue", () => {
  it("deduplicates pending and already loaded pages before a paid action", async () => {
    const first = deferred<{ ok: true; url: string }>();
    mocks.draw.mockReturnValueOnce(first.promise);
    const { result } = renderHook(usePicturebookImages);
    act(() => {
      result.current.draw(1, book().pages.slice(0, 1));
      result.current.draw(1, book().pages.slice(0, 2));
    });
    await waitFor(() => expect(mocks.draw).toHaveBeenCalledTimes(1));
    await act(async () => first.resolve({ ok: true, url: "first" }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.draw(1, book().pages.slice(0, 2)));
    expect(mocks.draw).toHaveBeenCalledTimes(2);
    expect(result.current.progress).toEqual({
      completed: 2,
      total: 2,
      failed: 0,
    });
  });

  it("does not start generation when reset happens while authentication is pending", async () => {
    const token = deferred<string>();
    mocks.token.mockReturnValueOnce(token.promise);
    const { result } = renderHook(usePicturebookImages);
    act(() => result.current.draw(1, book().pages));
    await waitFor(() => expect(mocks.token).toHaveBeenCalledOnce());
    act(() => result.current.reset({ 1: "new-story" }));
    await act(async () => token.resolve("old-token"));
    expect(mocks.draw).not.toHaveBeenCalled();
    expect(result.current.urls).toEqual({ 1: "new-story" });
    expect(result.current.isLoading).toBe(false);
  });

  it("stops queued generation after an account switch", async () => {
    const token = deferred<string>();
    mocks.token.mockReturnValueOnce(token.promise);
    const { result } = renderHook(usePicturebookImages);
    act(() => result.current.draw(1, book().pages));
    await waitFor(() => expect(mocks.token).toHaveBeenCalledOnce());
    useUserInfo.setState({
      userInfo: { id: "other", email: "", profileUrl: "" },
    });
    await act(async () => token.resolve("other-token"));
    expect(mocks.draw).not.toHaveBeenCalled();
  });

  it("does not continue an image batch after unmount", async () => {
    const first = deferred<{ ok: true; url: string }>();
    mocks.draw.mockReturnValueOnce(first.promise);
    const { result, unmount } = renderHook(usePicturebookImages);
    act(() => result.current.draw(1, book().pages));
    await waitFor(() => expect(mocks.draw).toHaveBeenCalledOnce());
    unmount();
    await act(async () => first.resolve({ ok: true, url: "stale" }));
    expect(mocks.draw).toHaveBeenCalledOnce();
  });

  it("ignores a stale batch response while a replacement story is drawing", async () => {
    const stale = deferred<{ ok: true; url: string }>();
    const current = deferred<{ ok: true; url: string }>();
    mocks.draw
      .mockReturnValueOnce(stale.promise)
      .mockReturnValueOnce(current.promise);
    const { result } = renderHook(usePicturebookImages);
    act(() => result.current.draw(1, book().pages));
    await waitFor(() => expect(mocks.draw).toHaveBeenCalledOnce());
    act(() => {
      result.current.reset();
      result.current.draw(2, book().pages.slice(0, 1));
    });
    await waitFor(() => expect(mocks.draw).toHaveBeenCalledTimes(2));
    await act(async () => stale.resolve({ ok: true, url: "old" }));
    expect(result.current.urls).toEqual({});
    expect(result.current.isLoading).toBe(true);
    await act(async () => current.resolve({ ok: true, url: "new" }));
    expect(result.current.urls).toEqual({ 1: "new" });
    expect(result.current.progress).toEqual({
      completed: 1,
      total: 1,
      failed: 0,
    });
  });

  it("clears stale failure progress after a successful explicit retry", async () => {
    mocks.draw.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(usePicturebookImages);
    act(() => result.current.draw(1, book().pages.slice(0, 1)));
    await waitFor(() => expect(result.current.progress.failed).toBe(1));
    act(() => result.current.draw(1, book().pages.slice(0, 1)));
    await waitFor(() => expect(result.current.urls[1]).toBe("image-1"));
    expect(result.current.progress).toEqual({
      completed: 1,
      total: 1,
      failed: 0,
    });
  });

  it("stops the queued batch when the provider is unavailable and allows a later explicit retry", async () => {
    mocks.draw.mockResolvedValueOnce({
      ok: false,
      message: "그림 생성 서비스가 잠시 쉬고 있어요.",
      retryable: false,
    });
    const { result } = renderHook(usePicturebookImages);
    act(() => result.current.draw(1, book().pages));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mocks.draw).toHaveBeenCalledOnce();
    expect(result.current.error).toBe("그림 생성 서비스가 잠시 쉬고 있어요.");
    expect(result.current.progress).toEqual({
      completed: 4,
      total: 4,
      failed: 4,
    });
    act(() => result.current.draw(1, book().pages));
    await waitFor(() => expect(result.current.progress.completed).toBe(4));
    expect(mocks.draw).toHaveBeenCalledTimes(5);
    expect(result.current.error).toBe("");
    expect(result.current.progress.failed).toBe(0);
  });

  it("invalidates an expired image without automatically generating another one", () => {
    const { result } = renderHook(usePicturebookImages);
    act(() => result.current.reset({ 1: "expired", 2: "working" }));
    act(() => {
      result.current.invalidate(1);
      result.current.invalidate(1);
    });
    expect(result.current.urls).toEqual({ 2: "working" });
    expect(result.current.progress.failed).toBe(1);
    expect(mocks.draw).not.toHaveBeenCalled();
  });
});
