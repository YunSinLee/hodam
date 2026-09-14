// @vitest-environment jsdom
// Regression: the default shelf mixed the previous story format with picturebooks.
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ threads: vi.fn() }));
vi.mock("@/app/api/thread", () => ({
  default: { fetchThreadsByUserId: mocks.threads },
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
vi.mock("@/app/components/GuideForSign", () => ({
  default: () => <p>로그인이 필요해요</p>,
}));

import MyStory from "../src/app/my-story/page";
import StoryArchive from "../src/app/my-story/archive/page";
import useUserInfo from "../src/services/hooks/use-user-info";
import { book } from "./fixtures";

const old = {
  id: 1,
  created_at: "2024-01-01",
  keywords: [{ keyword: "옛 토끼 이야기" }],
  messages: [{ id: 1 }],
};
const empty = {
  id: 2,
  created_at: "2024-01-01",
  keywords: [{ keyword: "빈 기록" }],
  messages: [],
};
const modern = {
  id: 3,
  created_at: "2026-09-14",
  raw_text: JSON.stringify(book("complete")),
};
beforeEach(() => {
  vi.resetAllMocks();
  useUserInfo.setState({
    isAuthReady: true,
    userInfo: { id: "owner", email: "", profileUrl: "" },
  });
  mocks.threads.mockResolvedValue([modern, old, empty]);
});
afterEach(cleanup);

describe("beta picturebook shelf and preserved stories", () => {
  it("defaults to picturebooks and keeps a visible route to all older records", async () => {
    render(<MyStory />);
    await screen.findByRole("heading", { name: "작은 용기" });
    expect(
      screen.queryByRole("heading", { name: "옛 토끼 이야기" }),
    ).toBeNull();
    expect(screen.queryByText("빈 기록")).toBeNull();
    expect(
      screen
        .getByRole("link", { name: "예전 동화 보관함 · 2개 ↗" })
        .getAttribute("href"),
    ).toBe("/my-story/archive");
    expect(screen.getByText("8쪽 · 결말 완성")).toBeTruthy();
  });

  it("keeps an old-only account's history accessible next to the first picturebook action", async () => {
    mocks.threads.mockResolvedValue([old]);
    render(<MyStory />);
    await screen.findByText("첫 번째 이야기를 기다리고 있어요.");
    expect(screen.getByRole("link", { name: "첫 그림책 만들기" })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /예전 동화 보관함 · 1개/ }),
    ).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("shows original readable stories in the archive and lets users inspect empty records", async () => {
    render(<StoryArchive />);
    await screen.findByRole("heading", { name: "옛 토끼 이야기" });
    expect(screen.queryByRole("heading", { name: "작은 용기" })).toBeNull();
    expect(screen.queryByText("빈 기록")).toBeNull();
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "empty" },
    });
    expect(screen.getByRole("heading", { name: "빈 기록" })).toBeTruthy();
    expect(screen.getByText("내용이 없는 기록")).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "← 내 그림책으로 돌아가기" })
        .getAttribute("href"),
    ).toBe("/my-story");
  });

  it("does not present picturebook-only search and filters to a fresh account", async () => {
    mocks.threads.mockResolvedValue([]);
    render(<MyStory />);
    await screen.findByText("첫 번째 이야기를 기다리고 있어요.");
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("link", { name: /예전 동화 보관함/ })).toBeNull();
  });

  it("opens empty records directly when an archive has no readable stories", async () => {
    mocks.threads.mockResolvedValue([empty]);
    render(<StoryArchive />);
    fireEvent.click(
      await screen.findByRole("button", { name: "보관된 기록 보기" }),
    );
    expect(screen.getByRole("heading", { name: "빈 기록" })).toBeTruthy();
    expect(screen.getByRole("combobox")).toHaveProperty("value", "empty");
  });

  it("clears archive entries after an account changes", async () => {
    render(<StoryArchive />);
    await screen.findByRole("heading", { name: "옛 토끼 이야기" });
    mocks.threads.mockResolvedValue([]);
    act(() =>
      useUserInfo.setState({
        userInfo: { id: "new-owner", email: "", profileUrl: "" },
      }),
    );
    await screen.findByText("보관된 예전 동화가 없어요.");
    expect(
      screen.queryByRole("heading", { name: "옛 토끼 이야기" }),
    ).toBeNull();
  });
});
