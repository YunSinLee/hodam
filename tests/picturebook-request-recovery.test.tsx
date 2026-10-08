// @vitest-environment jsdom
import { StrictMode } from "react";
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
  token: vi.fn(),
  push: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
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
  finishPicturebookAction: vi.fn(),
  drawPicturebookPageAction: vi.fn(async () => ({ ok: true, url: "image" })),
}));
vi.mock("@/app/utils/session", () => ({ requireAccessToken: mocks.token }));
vi.mock("@/app/components/picturebook/PicturebookViewer", () => ({
  default: ({ picturebook }: { picturebook: { title: string } }) => (
    <h2>{picturebook.title}</h2>
  ),
}));

import {
  defaultAdventure,
  prepareAdventureStarter,
  consumeAdventureStarter,
} from "../src/lib/picturebook/adventure";

import Service from "../src/app/service/page";
import {
  createFormModes,
  readFormDraft,
  saveFormDraft,
} from "../src/app/service/picturebook-form-draft";
import { initialInput } from "../src/app/utils/picturebook";
import {
  readPendingPicturebookRequest,
  readUnconfirmedPicturebookRequests,
  savePendingPicturebookRequest,
} from "../src/app/service/picturebook-request-recovery";
import useUserInfo from "../src/services/hooks/use-user-info";
import useBead from "../src/services/hooks/use-bead";
import {
  prepareSampleStarter,
  consumeSampleStarter,
} from "../src/lib/picturebook/sample";
import { book, input } from "./fixtures";

const owner = (id: string | undefined = "owner") =>
  useUserInfo.setState({
    isAuthReady: true,
    userInfo: { id, email: "", profileUrl: "" },
  });
function fill() {
  fireEvent.change(screen.getByLabelText("이름 또는 별명"), {
    target: { value: input.childName },
  });
  fireEvent.change(screen.getByLabelText("나이"), {
    target: { value: input.childAge },
  });
  fireEvent.change(screen.getByLabelText("오늘 있었던 일"), {
    target: { value: input.situation },
  });
  fireEvent.change(screen.getByLabelText("전하고 싶은 마음"), {
    target: { value: input.lesson },
  });
}
const success = { ok: true, threadId: 1, beadCount: 9, book: book() };
const pending = {
  userId: "owner",
  requestId: "11111111-2222-3333-4444-555555555555",
  input,
};
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  consumeSampleStarter();
  consumeAdventureStarter(undefined);
  owner();
  useBead.setState({
    bead: { id: "bead", user_id: "owner", count: 10, created: "today" },
  });
  mocks.token.mockResolvedValue("token");
  mocks.create.mockReset().mockResolvedValue(success);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("creation request recovery across page visits", () => {
  it("carries an explicit sample nickname through StrictMode and login without an old child's age", () => {
    useUserInfo.setState({
      isAuthReady: true,
      userInfo: { id: undefined, email: "", profileUrl: "" },
    });
    sessionStorage.setItem(
      "hodam-picturebook-input",
      JSON.stringify({ input, savedAt: Date.now() }),
    );
    prepareSampleStarter("보라");
    const page = render(
      <StrictMode>
        <Service />
      </StrictMode>,
    );
    expect(
      (screen.getByLabelText("이름 또는 별명") as HTMLInputElement).value,
    ).toBe("보라");
    expect((screen.getByLabelText("나이") as HTMLSelectElement).value).toBe("");
    fireEvent.change(screen.getByLabelText("나이"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "네 마음도 소중해" }));
    fireEvent.click(
      screen.getByRole("button", { name: "로그인하고 그림책 만들기" }),
    );
    expect(mocks.push).toHaveBeenCalledWith("/sign-in?next=/service");
    expect(mocks.create).not.toHaveBeenCalled();
    page.unmount();
    owner();
    render(
      <StrictMode>
        <Service />
      </StrictMode>,
    );
    expect(
      (screen.getByLabelText("이름 또는 별명") as HTMLInputElement).value,
    ).toBe("보라");
    expect((screen.getByLabelText("나이") as HTMLSelectElement).value).toBe(
      "5",
    );
    expect(
      (screen.getByLabelText("전하고 싶은 마음") as HTMLInputElement).value,
    ).toBe("네 마음도 소중해");
  });

  it("discards the sample hint when a paid generation request needs recovery", () => {
    savePendingPicturebookRequest(pending);
    prepareSampleStarter("보라");
    render(
      <StrictMode>
        <Service />
      </StrictMode>,
    );
    expect(
      (screen.getByLabelText("이름 또는 별명") as HTMLInputElement).value,
    ).toBe(input.childName);
    expect(consumeSampleStarter()).toBeNull();
    expect(readPendingPicturebookRequest("owner")).toEqual(pending);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  const confirmNewBook = () => {
    fireEvent.click(
      screen.getByRole("button", { name: "새 그림책 따로 만들기" }),
    );
    expect(screen.getByText(/곶감 1개를 별도로 사용해요/)).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "확인하고 새 그림책 작성" }),
    );
  };

  it("requires explicit confirmation before unlocking a separate paid book", () => {
    savePendingPicturebookRequest(pending);
    render(<Service />);
    fireEvent.click(
      screen.getByRole("button", { name: "새 그림책 따로 만들기" }),
    );
    expect(
      screen.getByText(/이전 요청은 나중에 내 책장에 저장될 수 있어요/),
    ).toBeTruthy();
    expect(readPendingPicturebookRequest("owner")).toEqual(pending);
    expect(
      (screen.getByLabelText("이름 또는 별명") as HTMLInputElement).matches(
        ":disabled",
      ),
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(
      screen.queryByRole("button", { name: "확인하고 새 그림책 작성" }),
    ).toBeNull();
    expect(readPendingPicturebookRequest("owner")).toEqual(pending);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("preserves an unresolved request when the user confirms a separate book", async () => {
    savePendingPicturebookRequest(pending);
    const page = render(<Service />);
    confirmNewBook();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(readPendingPicturebookRequest("owner")).toBeNull();
    expect(readUnconfirmedPicturebookRequests("owner")).toEqual([pending]);
    expect(
      (screen.getByLabelText("이름 또는 별명") as HTMLInputElement).matches(
        ":disabled",
      ),
    ).toBe(false);
    fill();
    fireEvent.click(
      screen.getByRole("button", { name: "오늘 밤 그림책 만들기" }),
    );
    await screen.findByText("작은 용기");
    expect(mocks.create.mock.calls[0][2]).not.toBe(pending.requestId);
    expect(readUnconfirmedPicturebookRequests("owner")).toEqual([pending]);
    page.unmount();
    render(<Service />);
    fireEvent.click(screen.getByText("미확인 요청 1건"));
    fireEvent.click(
      screen.getByRole("button", { name: "이 요청 이어서 확인하기" }),
    );
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(readPendingPicturebookRequest("owner")).toEqual(pending);
    fireEvent.click(
      screen.getByRole("button", { name: "이전 요청 이어서 확인하기" }),
    );
    await screen.findByText("작은 용기");
    expect(mocks.create.mock.calls[1][2]).toBe(pending.requestId);
    expect(readUnconfirmedPicturebookRequests("owner")).toEqual([]);
  });

  it("isolates unconfirmed requests and confirmation state when accounts change", () => {
    savePendingPicturebookRequest(pending);
    render(<Service />);
    fireEvent.click(
      screen.getByRole("button", { name: "새 그림책 따로 만들기" }),
    );
    act(() => owner("other"));
    expect(
      screen.queryByRole("button", { name: "확인하고 새 그림책 작성" }),
    ).toBeNull();
    expect(readPendingPicturebookRequest("owner")).toEqual(pending);
    act(() => owner());
    confirmNewBook();
    act(() => owner("other"));
    expect(screen.queryByText("미확인 요청 1건")).toBeNull();
    expect(readUnconfirmedPicturebookRequests("other")).toEqual([]);
    act(() => owner());
    expect(screen.getByText("미확인 요청 1건")).toBeTruthy();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("does not let a late old completion replace the explicitly chosen new book", async () => {
    let resolveOld!: (value: typeof success) => void;
    mocks.create.mockReturnValueOnce(
      new Promise(done => {
        resolveOld = done;
      }),
    );
    const first = render(<Service />);
    fill();
    fireEvent.click(
      screen.getByRole("button", { name: "오늘 밤 그림책 만들기" }),
    );
    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
    const oldId = mocks.create.mock.calls[0][2];
    first.unmount();
    render(<Service />);
    confirmNewBook();
    fill();
    mocks.create.mockResolvedValueOnce({
      ...success,
      threadId: 2,
      book: { ...book(), title: "새로 만든 책" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "오늘 밤 그림책 만들기" }),
    );
    await screen.findByText("새로 만든 책");
    await act(async () => resolveOld(success));
    expect(screen.getByText("새로 만든 책")).toBeTruthy();
    expect(screen.queryByText("작은 용기")).toBeNull();
    expect(readUnconfirmedPicturebookRequests("owner")[0].requestId).toBe(
      oldId,
    );
  });

  it("retains the previous request in the current page when storage blocks the separate-book transition", async () => {
    savePendingPicturebookRequest(pending);
    render(<Service />);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    confirmNewBook();
    fireEvent.click(screen.getByText("미확인 요청 1건"));
    fireEvent.click(
      screen.getByRole("button", { name: "이 요청 이어서 확인하기" }),
    );
    expect(mocks.create).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "이전 요청 이어서 확인하기" }),
    );
    await screen.findByText("작은 용기");
    expect(mocks.create.mock.calls[0][2]).toBe(pending.requestId);
  });

  it("starts one request when the form is submitted twice before authentication finishes", async () => {
    let resolveToken!: (token: string) => void;
    mocks.token.mockReturnValueOnce(
      new Promise(done => {
        resolveToken = done;
      }),
    );
    render(<Service />);
    fill();
    const form = screen.getByLabelText("이름 또는 별명").closest("form")!;
    act(() => {
      fireEvent.submit(form);
      fireEvent.submit(form);
    });
    await act(async () => resolveToken("token"));
    await screen.findByText("작은 용기");
    expect(mocks.token).toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledOnce();
  });

  it("retains the same paid request after a lost response and page reload", async () => {
    mocks.create.mockRejectedValueOnce(new Error("lost response"));
    const first = render(<Service />);
    fill();
    fireEvent.click(
      screen.getByRole("button", { name: "오늘 밤 그림책 만들기" }),
    );
    await screen.findByRole("alert");
    const originalRequest = mocks.create.mock.calls[0];
    expect(
      (screen.getByLabelText("이름 또는 별명") as HTMLInputElement).matches(
        ":disabled",
      ),
    ).toBe(true);
    fireEvent.change(screen.getByLabelText("이름 또는 별명"), {
      target: { value: "다른 이름" },
    });
    first.unmount();
    render(<Service />);
    expect(mocks.create).toHaveBeenCalledOnce();
    fireEvent.click(
      screen.getByRole("button", { name: "이전 요청 이어서 확인하기" }),
    );
    await screen.findByText("작은 용기");
    expect(mocks.create.mock.calls[1]).toEqual(originalRequest);
    expect(readPendingPicturebookRequest("owner")).toBeNull();
  });

  it("restores an in-flight request on returning to the page without automatically spending credits", async () => {
    let resolve!: (value: typeof success) => void;
    mocks.create.mockReturnValueOnce(
      new Promise(done => {
        resolve = done;
      }),
    );
    const first = render(<Service />);
    fill();
    fireEvent.click(
      screen.getByRole("button", { name: "오늘 밤 그림책 만들기" }),
    );
    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
    const originalRequest = mocks.create.mock.calls[0];
    first.unmount();
    const next = render(<Service />);
    expect(
      screen.getByRole("button", { name: "이전 요청 이어서 확인하기" }),
    ).toBeTruthy();
    expect(mocks.create).toHaveBeenCalledOnce();
    await act(async () => resolve(success));
    expect(readPendingPicturebookRequest("owner")?.requestId).toBe(
      originalRequest[2],
    );
    fireEvent.click(
      screen.getByRole("button", { name: "이전 요청 이어서 확인하기" }),
    );
    await screen.findByText("작은 용기");
    expect(mocks.create.mock.calls[1]).toEqual(originalRequest);
    next.unmount();
    render(<Service />);
    expect(
      screen.queryByRole("button", { name: "이전 요청 이어서 확인하기" }),
    ).toBeNull();
  });

  it("keeps an ambiguous server failure across page visits", async () => {
    mocks.create.mockResolvedValueOnce({
      ok: false,
      message: "저장 결과 확인 중",
      retrySameRequest: true,
    });
    const first = render(<Service />);
    fill();
    fireEvent.click(
      screen.getByRole("button", { name: "오늘 밤 그림책 만들기" }),
    );
    await screen.findByRole("alert");
    const originalRequest = mocks.create.mock.calls[0];
    first.unmount();
    render(<Service />);
    fireEvent.click(
      screen.getByRole("button", { name: "이전 요청 이어서 확인하기" }),
    );
    await screen.findByText("작은 용기");
    expect(mocks.create.mock.calls[1]).toEqual(originalRequest);
  });

  it("unlocks input and clears persistence after a definitive failure", async () => {
    mocks.create.mockResolvedValueOnce({
      ok: false,
      message: "곶감이 부족해요",
      retrySameRequest: false,
    });
    render(<Service />);
    fill();
    fireEvent.click(
      screen.getByRole("button", { name: "오늘 밤 그림책 만들기" }),
    );
    await screen.findByRole("alert");
    expect(readPendingPicturebookRequest("owner")).toBeNull();
    expect(
      (screen.getByLabelText("이름 또는 별명") as HTMLInputElement).matches(
        ":disabled",
      ),
    ).toBe(false);
    fireEvent.click(
      screen.getByRole("button", { name: "오늘 밤 그림책 만들기" }),
    );
    await screen.findByText("작은 용기");
    expect(mocks.create.mock.calls[1][2]).not.toEqual(
      mocks.create.mock.calls[0][2],
    );
  });

  it.each([false, undefined])(
    "retains a previously ambiguous identity even if a later retry returns retrySameRequest=%s",
    async retrySameRequest => {
      savePendingPicturebookRequest(pending);
      mocks.create.mockResolvedValueOnce({
        ok: false,
        message: "일시적인 생성 오류",
        retrySameRequest,
      });
      const first = render(<Service />);
      fireEvent.click(
        screen.getByRole("button", { name: "이전 요청 이어서 확인하기" }),
      );
      await screen.findByRole("alert");
      expect(readPendingPicturebookRequest("owner")?.requestId).toBe(
        pending.requestId,
      );
      first.unmount();
      render(<Service />);
      fireEvent.click(
        screen.getByRole("button", { name: "이전 요청 이어서 확인하기" }),
      );
      await screen.findByText("작은 용기");
      expect(mocks.create.mock.calls[1]).toEqual(mocks.create.mock.calls[0]);
    },
  );

  it("retains a lost-response request through a later model failure without reloading", async () => {
    mocks.create
      .mockRejectedValueOnce(new Error("lost response"))
      .mockResolvedValueOnce({
        ok: false,
        message: "생성 서비스 오류",
        retrySameRequest: false,
      });
    render(<Service />);
    fill();
    fireEvent.click(
      screen.getByRole("button", { name: "오늘 밤 그림책 만들기" }),
    );
    await screen.findByRole("alert");
    fireEvent.click(
      screen.getByRole("button", { name: "이전 요청 이어서 확인하기" }),
    );
    await screen.findByText("생성 서비스 오류");
    fireEvent.click(
      screen.getByRole("button", { name: "이전 요청 이어서 확인하기" }),
    );
    await screen.findByText("작은 용기");
    expect(mocks.create).toHaveBeenCalledTimes(3);
    expect(mocks.create.mock.calls[2]).toEqual(mocks.create.mock.calls[0]);
  });

  it("waits for the current owner and never resumes another account's request", async () => {
    savePendingPicturebookRequest(pending);
    useUserInfo.setState({
      isAuthReady: false,
      userInfo: { id: undefined, email: "", profileUrl: "" },
    });
    render(<Service />);
    expect(
      screen.queryByRole("button", { name: "이전 요청 이어서 확인하기" }),
    ).toBeNull();
    act(() => owner("other"));
    expect(
      screen.queryByRole("button", { name: "이전 요청 이어서 확인하기" }),
    ).toBeNull();
    expect(
      (screen.getByLabelText("이름 또는 별명") as HTMLInputElement).value,
    ).toBe("");
    act(() => owner());
    expect(
      (screen.getByLabelText("이름 또는 별명") as HTMLInputElement).value,
    ).toBe(input.childName);
    expect(mocks.create).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "이전 요청 이어서 확인하기" }),
    );
    await screen.findByText("작은 용기");
    expect(mocks.create).toHaveBeenCalledWith(
      input,
      "token",
      pending.requestId,
    );
  });

  it("does not overwrite a recovered request with an older login draft", () => {
    savePendingPicturebookRequest(pending);
    sessionStorage.setItem(
      "hodam-picturebook-input",
      JSON.stringify({
        input: { ...input, childName: "예전 별명" },
        savedAt: Date.now(),
      }),
    );
    render(<Service />);
    expect(
      (screen.getByLabelText("이름 또는 별명") as HTMLInputElement).value,
    ).toBe(input.childName);
  });

  it("still restores pre-login input without creating a book automatically", async () => {
    useUserInfo.setState({
      isAuthReady: true,
      userInfo: { id: undefined, email: "", profileUrl: "" },
    });
    const first = render(<Service />);
    fill();
    fireEvent.click(
      screen.getByRole("button", { name: "로그인하고 그림책 만들기" }),
    );
    expect(mocks.push).toHaveBeenCalledWith("/sign-in?next=/service");
    expect(mocks.create).not.toHaveBeenCalled();
    first.unmount();
    owner();
    render(<Service />);
    expect(
      (screen.getByLabelText("이름 또는 별명") as HTMLInputElement).value,
    ).toBe(input.childName);
    expect(
      screen.queryByRole("button", { name: "이전 요청 이어서 확인하기" }),
    ).toBeNull();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("keeps same-page recovery usable when browser storage is blocked", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    mocks.create.mockRejectedValueOnce(new Error("lost response"));
    render(<Service />);
    fill();
    fireEvent.click(
      screen.getByRole("button", { name: "오늘 밤 그림책 만들기" }),
    );
    await screen.findByRole("alert");
    fireEvent.click(
      screen.getByRole("button", { name: "이전 요청 이어서 확인하기" }),
    );
    await screen.findByText("작은 용기");
    expect(mocks.create.mock.calls[1]).toEqual(mocks.create.mock.calls[0]);
  });

  it("ignores malformed persisted input without breaking the form", () => {
    sessionStorage.setItem(
      "hodam-picturebook-request:owner",
      JSON.stringify({ ...pending, input: { childName: "only name" } }),
    );
    render(<Service />);
    expect(
      screen.queryByRole("button", { name: "이전 요청 이어서 확인하기" }),
    ).toBeNull();
    expect(screen.getByLabelText("이름 또는 별명")).toBeTruthy();
    expect(readPendingPicturebookRequest("owner")).toBeNull();
  });
});

describe("adventure creation and private companion handoff", () => {
  it("starts from world and companion without requiring a lesson, and restores a daily draft", async () => {
    render(<Service />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: /단짝과 상상 모험/ }));
    expect(screen.queryByLabelText("전하고 싶은 마음")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /바닷속 도서관/ }));
    fireEvent.click(screen.getByRole("button", { name: "여우" }));
    fireEvent.change(screen.getByLabelText("단짝 이름"), {
      target: { value: "보리" },
    });
    fireEvent.click(screen.getByRole("button", { name: /오늘의 이야기/ }));
    expect(
      (screen.getByLabelText("오늘 있었던 일") as HTMLInputElement).value,
    ).toBe(input.situation);
    fireEvent.click(screen.getByRole("button", { name: /단짝과 상상 모험/ }));
    expect((screen.getByLabelText("단짝 이름") as HTMLInputElement).value).toBe(
      "보리",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "우리의 모험 그림책 만들기" }),
    );
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
    expect(mocks.create.mock.calls[0][0]).toMatchObject({
      childName: input.childName,
      lesson: "",
      adventure: {
        world: "ocean-library",
        companion: "fox",
        companionName: "보리",
      },
    });
  });
  it("consumes a saved companion after auth resolves, through StrictMode, and clears mode caches on account changes", () => {
    const saved = {
      ...book("complete"),
      adventure: { ...defaultAdventure, companionName: "비밀단짝" },
    };
    prepareAdventureStarter(saved, "owner");
    useUserInfo.setState({
      isAuthReady: false,
      userInfo: { id: undefined, email: "", profileUrl: "" },
    });
    render(
      <StrictMode>
        <Service />
      </StrictMode>,
    );
    act(() => owner());
    expect((screen.getByLabelText("단짝 이름") as HTMLInputElement).value).toBe(
      "비밀단짝",
    );
    expect(
      (screen.getByLabelText("이름 또는 별명") as HTMLInputElement).value,
    ).toBe(input.childName);
    fireEvent.click(screen.getByRole("button", { name: /오늘의 이야기/ }));
    act(() => owner("other"));
    fireEvent.click(screen.getByRole("button", { name: /단짝과 상상 모험/ }));
    expect((screen.getByLabelText("단짝 이름") as HTMLInputElement).value).toBe(
      "두부",
    );
    expect(
      (screen.getByLabelText("이름 또는 별명") as HTMLInputElement).value,
    ).toBe("");
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("keeps the pending charged request ahead of a new adventure and drops the unused handoff", () => {
    savePendingPicturebookRequest(pending);
    prepareAdventureStarter(
      { ...book("complete"), adventure: defaultAdventure },
      "owner",
    );
    render(
      <StrictMode>
        <Service />
      </StrictMode>,
    );
    expect(screen.queryByLabelText("단짝 이름")).toBeNull();
    expect(
      (screen.getByLabelText("오늘 있었던 일") as HTMLInputElement).value,
    ).toBe(input.situation);
    expect(consumeAdventureStarter("owner")).toBeNull();
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

it("clears unsent direct adventure input and mode caches when the signed-in account changes", () => {
  render(<Service />);
  fill();
  fireEvent.click(screen.getByRole("button", { name: /단짝과 상상 모험/ }));
  fireEvent.change(screen.getByLabelText("단짝 이름"), {
    target: { value: "비밀친구" },
  });
  fireEvent.change(screen.getByLabelText(/모험에 더하고 싶은 것/), {
    target: { value: "개인적인 소재" },
  });
  act(() => owner("other"));
  expect(
    (screen.getByLabelText("이름 또는 별명") as HTMLInputElement).value,
  ).toBe("");
  fireEvent.click(screen.getByRole("button", { name: /단짝과 상상 모험/ }));
  expect((screen.getByLabelText("단짝 이름") as HTMLInputElement).value).toBe(
    "두부",
  );
  expect(
    (screen.getByLabelText(/모험에 더하고 싶은 것/) as HTMLInputElement).value,
  ).toBe("");
  expect(mocks.create).not.toHaveBeenCalled();
});

describe("unfinished form drafts", () => {
  it("restores incomplete inputs and both mode memories after remount in StrictMode", () => {
    const first = render(<Service />);
    fireEvent.change(screen.getByLabelText("이름 또는 별명"), {
      target: { value: "아직 작성 중" },
    });
    fireEvent.change(screen.getByLabelText("오늘 있었던 일"), {
      target: { value: "오늘의 한 장면" },
    });
    fireEvent.click(screen.getByRole("button", { name: /단짝과 상상 모험/ }));
    fireEvent.change(screen.getByLabelText("단짝 이름"), {
      target: { value: "" },
    });
    first.unmount();
    render(
      <StrictMode>
        <Service />
      </StrictMode>,
    );
    expect(screen.getByText("작성하던 이야기를 불러왔어요")).toBeTruthy();
    expect(
      (screen.getByLabelText("이름 또는 별명") as HTMLInputElement).value,
    ).toBe("아직 작성 중");
    expect((screen.getByLabelText("나이") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("단짝 이름") as HTMLInputElement).value).toBe(
      "",
    );
    fireEvent.click(screen.getByRole("button", { name: /오늘의 이야기/ }));
    expect(
      (screen.getByLabelText("오늘 있었던 일") as HTMLInputElement).value,
    ).toBe("오늘의 한 장면");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("restores each owner separately and never adopts a guest draft during unrelated login", () => {
    useUserInfo.setState({
      userInfo: { id: undefined, email: "", profileUrl: "" },
    });
    render(<Service />);
    fireEvent.change(screen.getByLabelText("이름 또는 별명"), {
      target: { value: "방문자" },
    });
    act(() => owner());
    expect(
      (screen.getByLabelText("이름 또는 별명") as HTMLInputElement).value,
    ).toBe("");
    fireEvent.change(screen.getByLabelText("이름 또는 별명"), {
      target: { value: "첫 계정" },
    });
    act(() => owner("other"));
    expect(
      (screen.getByLabelText("이름 또는 별명") as HTMLInputElement).value,
    ).toBe("");
    fireEvent.change(screen.getByLabelText("이름 또는 별명"), {
      target: { value: "둘째 계정" },
    });
    act(() => owner());
    expect(
      (screen.getByLabelText("이름 또는 별명") as HTMLInputElement).value,
    ).toBe("첫 계정");
    expect(readFormDraft("other").draft?.input.childName).toBe("둘째 계정");
    expect(readFormDraft(undefined).draft?.input.childName).toBe("방문자");
  });

  it("waits for auth before hydrating or allowing edits", () => {
    saveFormDraft("owner", input, createFormModes(input));
    useUserInfo.setState({ isAuthReady: false });
    render(<Service />);
    expect(screen.queryByLabelText("이름 또는 별명")).toBeNull();
    expect(readFormDraft("owner").draft?.input).toEqual(input);
    act(() => owner());
    expect(
      (screen.getByLabelText("이름 또는 별명") as HTMLInputElement).value,
    ).toBe(input.childName);
  });

  it("keeps an owner draft ahead of URL defaults and an explicit starter ahead of the draft", () => {
    saveFormDraft("owner", input, createFormModes(input));
    window.history.replaceState(
      null,
      "",
      "/service?mode=adventure&example=friend",
    );
    const first = render(<Service />);
    expect(screen.queryByLabelText("단짝 이름")).toBeNull();
    expect(
      (screen.getByLabelText("오늘 있었던 일") as HTMLInputElement).value,
    ).toBe(input.situation);
    first.unmount();
    prepareAdventureStarter(
      {
        ...book("complete"),
        adventure: { ...defaultAdventure, companionName: "새 단짝" },
      },
      "owner",
    );
    render(<Service />);
    expect((screen.getByLabelText("단짝 이름") as HTMLInputElement).value).toBe(
      "새 단짝",
    );
    window.history.replaceState(null, "", "/");
  });

  it("requires an explicit clear, removes hidden modes, and leaves paid recovery untouched", () => {
    const first = render(<Service />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: /단짝과 상상 모험/ }));
    fireEvent.change(screen.getByLabelText("단짝 이름"), {
      target: { value: "잊을 단짝" },
    });
    savePendingPicturebookRequest({ ...pending, userId: "other" });
    fireEvent.click(screen.getByRole("button", { name: "임시 보관 비우기" }));
    expect(readFormDraft("owner").draft).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "계속 작성하기" }));
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "임시 보관 비우기" }),
    );
    expect((screen.getByLabelText("단짝 이름") as HTMLInputElement).value).toBe(
      "잊을 단짝",
    );
    fireEvent.click(screen.getByRole("button", { name: "임시 보관 비우기" }));
    fireEvent.click(screen.getByRole("button", { name: "작성 내용 비우기" }));
    expect(readFormDraft("owner").draft).toBeNull();
    expect(readPendingPicturebookRequest("other")?.requestId).toBe(
      pending.requestId,
    );
    first.unmount();
    render(<Service />);
    expect(
      (screen.getByLabelText("오늘 있었던 일") as HTMLInputElement).value,
    ).toBe("");
    fireEvent.click(screen.getByRole("button", { name: /단짝과 상상 모험/ }));
    expect((screen.getByLabelText("단짝 이름") as HTMLInputElement).value).toBe(
      defaultAdventure.companionName,
    );
  });

  it("reports failed storage and failed deletion without preventing signed-in form editing", () => {
    render(<Service />);
    fill();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    fireEvent.change(screen.getByLabelText("이름 또는 별명"), {
      target: { value: "현재 입력" },
    });
    expect(
      screen.getByText("이 브라우저에 작성 내용을 보관하지 못했어요"),
    ).toBeTruthy();
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    fireEvent.click(screen.getByRole("button", { name: "임시 보관 비우기" }));
    fireEvent.click(screen.getByRole("button", { name: "작성 내용 비우기" }));
    expect(
      screen.getByText("화면은 비웠지만 보관한 내용은 지우지 못했어요"),
    ).toBeTruthy();
    expect(
      (screen.getByLabelText("이름 또는 별명") as HTMLInputElement).value,
    ).toBe("");
  });

  it("keeps pending recovery ahead of form drafts and clears the draft after successful creation", async () => {
    saveFormDraft(
      "owner",
      { ...initialInput, childName: "새로 쓰던 이름" },
      createFormModes(initialInput),
    );
    savePendingPicturebookRequest(pending);
    render(<Service />);
    expect(
      (screen.getByLabelText("이름 또는 별명") as HTMLInputElement).value,
    ).toBe(input.childName);
    expect(
      screen.queryByRole("button", { name: "임시 보관 비우기" }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "이전 요청 이어서 확인하기" }),
    );
    await screen.findByText("작은 용기");
    expect(readFormDraft("owner").draft).toBeNull();
    expect(mocks.create).toHaveBeenCalledWith(
      input,
      "token",
      pending.requestId,
    );
  });
});
