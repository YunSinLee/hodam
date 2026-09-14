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

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  finish: vi.fn(),
  draw: vi.fn(),
  token: vi.fn(),
  getThread: vi.fn(),
  getImages: vi.fn(),
  getMessages: vi.fn(),
  push: vi.fn(),
  params: { thread_id: "1" },
}));
vi.mock("next/navigation", () => ({
  useParams: () => mocks.params,
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));
vi.mock("@/app/api/story-actions", () => ({
  createPicturebookAction: mocks.create,
  finishPicturebookAction: mocks.finish,
  drawPicturebookPageAction: mocks.draw,
}));
vi.mock("@/app/utils/session", () => ({ requireAccessToken: mocks.token }));
vi.mock("@/app/api/thread", () => ({
  default: { getThreadByID: mocks.getThread },
}));
vi.mock("@/app/api/image", () => ({
  default: { getPageImages: mocks.getImages },
}));
vi.mock("@/app/api/messages", () => ({
  default: { fetchMessages: mocks.getMessages },
}));
vi.mock("@/app/components/GuideForSign", () => ({
  default: () => <p>로그인 안내</p>,
}));
vi.mock("@/app/components/MessageDisplay", () => ({
  default: () => <p>지난 동화</p>,
}));
vi.mock("@/app/components/picturebook/PicturebookInputForm", () => ({
  default: ({
    value,
    onChange,
    onSubmit,
  }: {
    value: PicturebookInput;
    onChange: (value: PicturebookInput) => void;
    onSubmit: () => void;
  }) => (
    <div>
      <span>{value.childName}</span>
      <button onClick={() => onChange(input)}>입력하기</button>
      <button onClick={onSubmit}>만들기</button>
    </div>
  ),
}));
vi.mock("@/app/components/picturebook/PicturebookViewer", () => ({
  default: ({
    picturebook,
    onSelectChoice,
    isEndingLoading,
    selectedChoiceId,
    imageUrls,
  }: {
    picturebook: PicturebookDraft;
    onSelectChoice: (choice: "A") => void;
    isEndingLoading: boolean;
    selectedChoiceId?: string;
    imageUrls: Record<number, string>;
  }) => (
    <div>
      <h2>{picturebook.title}</h2>
      <span>{picturebook.status}</span>
      <span data-testid="selected">{selectedChoiceId}</span>
      <span data-testid="images">{JSON.stringify(imageUrls)}</span>
      <button disabled={isEndingLoading} onClick={() => onSelectChoice("A")}>
        결말 선택
      </button>
    </div>
  ),
}));

import MyStoryDetail from "../src/app/my-story/[thread_id]/page";
import Service from "../src/app/service/page";
import type {
  PicturebookDraft,
  PicturebookInput,
} from "../src/app/types/openai";
import useBead from "../src/services/hooks/use-bead";
import useUserInfo from "../src/services/hooks/use-user-info";

import { book, input } from "./fixtures";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
const setOwner = (id = "owner") =>
  useUserInfo.setState({
    isAuthReady: true,
    userInfo: { id, email: "", profileUrl: "" },
  });
const savedThread = (id: number, owner = "owner", hasImage = false) => ({
  id,
  user_id: owner,
  has_image: hasImage,
  raw_text: JSON.stringify({ ...book(), title: `책 ${id}` }),
});
const createSuccess = (id: number) => ({
  ok: true as const,
  threadId: id,
  beadCount: 9,
  book: { ...book(), title: `책 ${id}` },
});

beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  mocks.params.thread_id = "1";
  setOwner();
  useBead.setState({
    bead: { id: "bead", user_id: "owner", count: 10, created: "today" },
  });
  mocks.token.mockResolvedValue("token");
  mocks.draw.mockResolvedValue({ ok: true, url: "image" });
  mocks.getThread.mockImplementation(async (id: number) =>
    savedThread(id, useUserInfo.getState().userInfo.id),
  );
  mocks.getImages.mockResolvedValue({});
  mocks.getMessages.mockResolvedValue({});
  mocks.create.mockResolvedValue(createSuccess(1));
  mocks.finish.mockResolvedValue({ ok: true, book: book("complete") });
});
afterEach(cleanup);

describe("saved-book client recovery", () => {
  it("does not apply an ending from the previously opened book", async () => {
    const pending = deferred<{ ok: true; book: PicturebookDraft }>();
    mocks.finish.mockReturnValueOnce(pending.promise);
    const { rerender } = render(<MyStoryDetail />);
    await screen.findByText("책 1");
    fireEvent.click(screen.getByRole("button", { name: "결말 선택" }));
    await waitFor(() => expect(mocks.finish).toHaveBeenCalledOnce());
    mocks.params.thread_id = "2";
    rerender(<MyStoryDetail />);
    await screen.findByText("책 2");
    await act(async () =>
      pending.resolve({ ok: true, book: book("complete") }),
    );
    expect(screen.getByText("책 2")).toBeTruthy();
    expect(screen.queryByText("complete")).toBeNull();
    expect(mocks.draw).not.toHaveBeenCalled();
  });

  it("does not send a former owner's ending after the session changes during token retrieval", async () => {
    const pending = deferred<string>();
    mocks.token.mockReturnValueOnce(pending.promise);
    render(<MyStoryDetail />);
    await screen.findByText("책 1");
    fireEvent.click(screen.getByRole("button", { name: "결말 선택" }));
    act(() => setOwner("other"));
    await act(async () => pending.resolve("other-token"));
    expect(mocks.finish).not.toHaveBeenCalled();
    expect(mocks.draw).not.toHaveBeenCalled();
  });

  it("keeps the new book's stored images when the old initial fetch finishes late", async () => {
    const oldImages = deferred<Record<number, string>>();
    mocks.getThread.mockImplementation(async (id: number) =>
      savedThread(id, "owner", true),
    );
    mocks.getImages
      .mockReturnValueOnce(oldImages.promise)
      .mockResolvedValueOnce({ 1: "new-image" });
    const { rerender } = render(<MyStoryDetail />);
    await waitFor(() => expect(mocks.getImages).toHaveBeenCalledOnce());
    mocks.params.thread_id = "2";
    rerender(<MyStoryDetail />);
    await screen.findByText("책 2");
    await act(async () => oldImages.resolve({ 1: "old-image" }));
    expect(screen.getByTestId("images").textContent).toContain("new-image");
    expect(screen.getByTestId("images").textContent).not.toContain("old-image");
  });

  it("offers reload even when an image fetch failed after story text loaded", async () => {
    mocks.getThread.mockResolvedValue(savedThread(1, "owner", true));
    mocks.getImages
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ 1: "restored" });
    render(<MyStoryDetail />);
    fireEvent.click(
      await screen.findByRole("button", { name: "다시 불러오기" }),
    );
    await waitFor(() =>
      expect(screen.getByTestId("images").textContent).toContain("restored"),
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("waits for stored images before allowing generation and retains them when adding an ending", async () => {
    const images = deferred<Record<number, string>>();
    mocks.getThread.mockResolvedValue(savedThread(1, "owner", true));
    mocks.getImages.mockReturnValueOnce(images.promise);
    render(<MyStoryDetail />);
    await waitFor(() => expect(mocks.getImages).toHaveBeenCalledOnce());
    expect(
      screen.queryByRole("button", { name: "빠진 그림 채우기" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "결말 선택" })).toBeNull();
    await act(async () =>
      images.resolve({
        1: "saved-1",
        2: "saved-2",
        3: "saved-3",
        4: "saved-4",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "결말 선택" }));
    await waitFor(() => expect(mocks.draw).toHaveBeenCalledTimes(4));
    expect(mocks.draw.mock.calls.map(call => call[1])).toEqual([5, 6, 7, 8]);
    expect(screen.getByTestId("images").textContent).toContain("saved-1");
    expect(
      screen.queryByRole("button", { name: "빠진 그림 채우기" }),
    ).toBeNull();
  });

  it("shows safe generation errors and keeps the selected choice and saved book", async () => {
    mocks.finish.mockResolvedValueOnce({
      ok: false,
      message: "이야기 생성 서비스가 잠시 쉬고 있어요.",
      retryable: false,
    });
    render(<MyStoryDetail />);
    await screen.findByText("책 1");
    fireEvent.click(screen.getByRole("button", { name: "결말 선택" }));
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "이야기 생성 서비스가 잠시 쉬고 있어요.",
    );
    expect(screen.getByText("책 1")).toBeTruthy();
    expect(screen.getByTestId("selected").textContent).toBe("A");
    expect(mocks.draw).not.toHaveBeenCalled();
  });
});

describe("creation client ownership", () => {
  const start = () => {
    fireEvent.click(screen.getByRole("button", { name: "입력하기" }));
    fireEvent.click(screen.getByRole("button", { name: "만들기" }));
  };

  it("does not create a former owner's book after authentication changes", async () => {
    const pending = deferred<string>();
    mocks.token.mockReturnValueOnce(pending.promise);
    render(<Service />);
    start();
    act(() => setOwner("other"));
    await act(async () => pending.resolve("other-token"));
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("does not generate illustrations or update balance after leaving the page", async () => {
    const pending = deferred<ReturnType<typeof createSuccess>>();
    mocks.create.mockReturnValueOnce(pending.promise);
    const { unmount } = render(<Service />);
    start();
    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
    unmount();
    await act(async () => pending.resolve(createSuccess(1)));
    expect(mocks.draw).not.toHaveBeenCalled();
    expect(useBead.getState().bead.count).toBe(10);
  });

  it("clears an already opened book when the account changes", async () => {
    render(<Service />);
    start();
    await screen.findByText("책 1");
    act(() => setOwner("other"));
    expect(screen.queryByText("책 1")).toBeNull();
    expect(screen.getByRole("button", { name: "만들기" })).toBeTruthy();
  });

  it("still offers to retry an earlier missing image after the ending batch succeeds", async () => {
    mocks.draw.mockResolvedValueOnce({
      ok: false,
      message: "다시 요청해주세요.",
      retryable: true,
    });
    render(<Service />);
    start();
    await screen.findByRole("button", { name: "빠진 그림 다시 요청하기" });
    fireEvent.click(screen.getByRole("button", { name: "결말 선택" }));
    await waitFor(() => expect(mocks.draw).toHaveBeenCalledTimes(8));
    fireEvent.click(
      screen.getByRole("button", { name: "빠진 그림 다시 요청하기" }),
    );
    await waitFor(() => expect(mocks.draw).toHaveBeenCalledTimes(9));
    expect(mocks.draw.mock.calls[8][1]).toBe(1);
    expect(
      screen.queryByRole("button", { name: "빠진 그림 다시 요청하기" }),
    ).toBeNull();
  });

  it("does not let an old failure cancel a new account's active request", async () => {
    const old = deferred<ReturnType<typeof createSuccess>>();
    const current = deferred<ReturnType<typeof createSuccess>>();
    mocks.create
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(current.promise);
    render(<Service />);
    start();
    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
    act(() => setOwner("other"));
    start();
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2));
    await act(async () => old.reject(new Error("late network error")));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button", { name: "만들기" })).toBeNull();
    await act(async () => current.resolve(createSuccess(2)));
    expect(screen.getByText("책 2")).toBeTruthy();
  });

  it.each(["transport", "ambiguous save"])(
    "reuses request identity after %s failure",
    async failure => {
      if (failure === "transport")
        mocks.create.mockRejectedValueOnce(new Error("lost response"));
      else
        mocks.create.mockResolvedValueOnce({
          ok: false,
          message: "저장을 확인하고 있어요.",
          retrySameRequest: true,
        });
      render(<Service />);
      start();
      await screen.findByRole("alert");
      fireEvent.click(screen.getByRole("button", { name: "만들기" }));
      await screen.findByText("책 1");
      expect(mocks.create).toHaveBeenCalledTimes(2);
      expect(mocks.create.mock.calls[1]).toEqual(mocks.create.mock.calls[0]);
    },
  );
});
