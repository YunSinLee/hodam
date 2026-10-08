// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import imageApi from "@/app/api/image";
import threadApi from "@/app/api/thread";
import type { PicturebookDraft, ThreadWithUser } from "@/app/types/openai";
import {
  getReadingLibrary,
  saveReadingProgress,
  setBookFavorite,
} from "@/lib/client/reading-library";
import { defaultAdventure } from "@/lib/picturebook/adventure";
import { createSampleBook } from "@/lib/picturebook/sample";
import useUserInfo from "@/services/hooks/use-user-info";

import MyStoryLibrary from "./MyStoryLibrary";

vi.mock("@/app/api/thread", () => ({
  default: { fetchThreadsByUserId: vi.fn() },
}));
vi.mock("@/app/api/image", () => ({ default: { getBookPreviews: vi.fn() } }));
vi.mock("@/app/components/GuideForSign", () => ({
  default: () => <p>로그인이 필요해요</p>,
}));

function thread(
  id: number,
  title: string,
  overrides: Partial<PicturebookDraft> = {},
): ThreadWithUser {
  return {
    id,
    openai_thread_id: `thread-${id}`,
    created_at: "2026-10-08T00:00:00.000Z",
    user_id: "owner-a",
    able_english: false,
    has_image: false,
    raw_text: JSON.stringify({
      ...createSampleBook("아이", "A"),
      childAge: "6",
      title,
      ...overrides,
    }),
    user: { id: "owner-a", email: "a@example.com", display_name: "부모" },
    keywords: [],
  };
}

describe("MyStoryLibrary discovery", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(imageApi.getBookPreviews).mockResolvedValue({});
    useUserInfo.setState({
      userInfo: { id: "owner-a", email: "a@example.com", profileUrl: "" },
      isAuthReady: true,
    });
    vi.mocked(threadApi.fetchThreadsByUserId).mockResolvedValue([
      thread(11, "작은 하루"),
      thread(12, "달의 모험", { adventure: defaultAdventure }),
      thread(13, "바다의 모험", {
        adventure: { ...defaultAdventure, world: "ocean-library" },
      }),
    ]);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("favorites books through separate accessible buttons and filters them", async () => {
    render(<MyStoryLibrary />);
    await screen.findByRole("heading", { name: "작은 하루" });
    const favorite = screen.getByRole("button", {
      name: "작은 하루 좋아하는 책에 담기",
    });
    expect(favorite.closest("a")).toBeNull();
    fireEvent.click(favorite);
    expect(getReadingLibrary("owner-a").books[11].favorite).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "좋아하는 책 · 1" }));
    expect(screen.getByRole("heading", { name: "작은 하루" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "달의 모험" })).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "작은 하루 좋아하는 책에서 빼기" }),
    );
    expect(
      screen.getByRole("heading", { name: "다시 읽고 싶은 책을 골라보세요." }),
    ).toBeTruthy();
  });

  it("groups adventures by child and companion and finds companion names", async () => {
    render(<MyStoryLibrary />);
    await screen.findByRole("heading", { name: "달의 모험" });
    fireEvent.click(screen.getByRole("button", { name: "단짝 모아보기" }));
    const group = screen.getByRole("region", { name: "아이 · 토끼 두부" });
    expect(
      within(group).getByRole("heading", { name: "달의 모험", level: 3 }),
    ).toBeTruthy();
    expect(
      within(group).getByRole("heading", { name: "바다의 모험", level: 3 }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "하루를 담은 그림책" }),
    ).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "두부" },
    });
    expect(screen.queryByRole("heading", { name: "작은 하루" })).toBeNull();
    expect(screen.getByRole("heading", { name: "달의 모험" })).toBeTruthy();
  });

  it("shows an unfinished reading bookmark but hides finished reads", async () => {
    saveReadingProgress("owner-a", 11, {
      pageIndex: 2,
      pageCount: 8,
      completed: false,
    });
    saveReadingProgress("owner-a", 12, {
      pageIndex: 6,
      pageCount: 8,
      completed: true,
    });
    render(<MyStoryLibrary />);
    const resume = await screen.findByRole("region", { name: "작은 하루" });
    expect(within(resume).getByText("3쪽에 책갈피가 있어요.")).toBeTruthy();
    expect(within(resume).getByRole("link").getAttribute("href")).toBe(
      "/my-story/11#continue-reading",
    );
    act(() => {
      saveReadingProgress("owner-a", 11, {
        pageIndex: 7,
        pageCount: 8,
        completed: true,
      });
    });
    expect(screen.queryByText("마지막으로 펼친 책")).toBeNull();
  });

  it("does not expose the previous account's shelf or preferences after switching", async () => {
    setBookFavorite("owner-a", 11, true);
    render(<MyStoryLibrary />);
    await screen.findByRole("button", { name: "좋아하는 책 · 1" });
    vi.mocked(threadApi.fetchThreadsByUserId).mockResolvedValue([
      thread(11, "다른 계정의 책"),
    ]);
    act(() => {
      useUserInfo.setState({
        userInfo: { id: "owner-b", email: "b@example.com", profileUrl: "" },
      });
    });
    expect(screen.queryByRole("heading", { name: "작은 하루" })).toBeNull();
    await screen.findByRole("heading", { name: "다른 계정의 책" });
    expect(screen.getByRole("button", { name: "좋아하는 책" })).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "다른 계정의 책 좋아하는 책에 담기" })
        .getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("reports storage failures instead of displaying a saved favorite", async () => {
    render(<MyStoryLibrary />);
    await screen.findByRole("heading", { name: "작은 하루" });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    fireEvent.click(
      screen.getByRole("button", { name: "작은 하루 좋아하는 책에 담기" }),
    );
    expect(
      screen.getByText(
        "브라우저에 저장하지 못했어요. 저장 공간과 사이트 설정을 확인해주세요.",
      ),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "작은 하루 좋아하는 책에 담기" })
        .getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("keeps pagination and can find a favorite beyond the first page", async () => {
    vi.mocked(threadApi.fetchThreadsByUserId).mockResolvedValue(
      Array.from({ length: 25 }, (_, index) =>
        thread(index + 1, `그림책 ${index + 1}`),
      ),
    );
    setBookFavorite("owner-a", 25, true);
    render(<MyStoryLibrary />);
    await screen.findByRole("heading", { name: "그림책 1" });
    expect(screen.queryByRole("heading", { name: "그림책 25" })).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "이야기 더 보기 · 1권 남음" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "그림책 25" }).closest("a"),
      ).toBe(document.activeElement),
    );
    fireEvent.click(screen.getByRole("button", { name: "좋아하는 책 · 1" }));
    expect(screen.getByRole("heading", { name: "그림책 25" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "그림책 1" })).toBeNull();
  });

  it("keeps a draft's last-page choices resumable", async () => {
    vi.mocked(threadApi.fetchThreadsByUserId).mockResolvedValue([
      thread(11, "결말을 기다리는 책", createSampleBook("아이")),
    ]);
    saveReadingProgress("owner-a", 11, {
      pageIndex: 3,
      pageCount: 4,
      completed: false,
    });
    render(<MyStoryLibrary />);
    await screen.findByText("4쪽에 책갈피가 있어요.");
    expect(
      screen.getByRole("link", { name: "읽던 그림책 열기 ↗" }),
    ).toBeTruthy();
  });
});
