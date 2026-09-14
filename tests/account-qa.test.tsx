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
import useUserInfo from "../src/services/hooks/use-user-info";
import { book } from "./fixtures";

const mocks = vi.hoisted(() => ({
  threads: vi.fn(),
  profile: vi.fn(),
  updateName: vi.fn(),
  purchase: vi.fn(),
  replace: vi.fn(),
  fetch: vi.fn(),
  requestPayment: vi.fn(),
}));
const router = { replace: mocks.replace };
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/profile",
}));
vi.mock("next/script", () => ({
  default: ({ onReady }: { onReady: () => void }) => (
    <button onClick={onReady}>load payment SDK</button>
  ),
}));
vi.mock("@/app/api/thread", () => ({
  default: { fetchThreadsByUserId: mocks.threads },
}));
vi.mock("@/app/api/profile", () => ({
  default: {
    getUserProfile: mocks.profile,
    updateDisplayName: mocks.updateName,
  },
}));
vi.mock("@/app/api/bead", () => ({
  default: { purchaseBeads: mocks.purchase },
}));
vi.mock("@/app/api/user", () => ({ default: { signOut: vi.fn() } }));
import MyStory from "../src/app/my-story/page";
import ProfilePage from "../src/app/profile/page";
import BeadPage from "../src/app/bead/page";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
}
function signIn(id = "owner") {
  useUserInfo.setState({
    isAuthReady: true,
    userInfo: { id, email: `${id}@example.test`, profileUrl: "" },
  });
}
const profile = {
  id: "owner",
  display_name: "기존 이름",
  email: "owner@example.test",
  profileUrl: "",
  created_at: "2026-01-01",
};
beforeEach(() => {
  vi.resetAllMocks();
  signIn();
  window.history.replaceState({}, "", "/profile");
  mocks.profile.mockResolvedValue(profile);
  vi.stubGlobal("fetch", mocks.fetch);
  vi.stubEnv("NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY", "test_client_key");
  window.TossPayments = () => ({ requestPayment: mocks.requestPayment });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("authenticated account QA", () => {
  it("renders 24 books at a time while searching the entire loaded shelf", async () => {
    mocks.threads.mockResolvedValue(
      Array.from({ length: 50 }, (_, index) => ({
        id: index + 1,
        created_at: "2026-01-01",
        raw_text: JSON.stringify({ ...book(), title: `이야기 ${index + 1}` }),
      })),
    );
    render(<MyStory />);
    await screen.findByRole("button", { name: /이야기 더 보기/ });
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(24);
    fireEvent.click(screen.getByRole("button", { name: /이야기 더 보기/ }));
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(48);
    expect(document.activeElement?.getAttribute("href")).toBe("/my-story/25");
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "이야기 50" },
    });
    expect(screen.getByRole("heading", { name: "이야기 50" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /이야기 더 보기/ })).toBeNull();
  });
  it("does not call empty legacy records completed stories and preserves them in a separate filter", async () => {
    mocks.threads.mockResolvedValue([
      {
        id: 1,
        created_at: "2026-01-01",
        keywords: [{ keyword: "빈 기록" }],
        messages: [],
      },
      {
        id: 2,
        created_at: "2026-01-01",
        raw_text: JSON.stringify(book("complete")),
      },
      {
        id: 3,
        created_at: "2026-01-01",
        keywords: [{ keyword: "예전 동화" }],
        messages: [{ id: 1 }],
      },
    ]);
    render(<MyStory />);
    await screen.findByRole("heading", { name: "작은 용기" });
    expect(screen.queryByRole("heading", { name: "빈 기록" })).toBeNull();
    expect(screen.getByRole("heading", { name: "예전 동화" })).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "complete" },
    });
    expect(screen.queryByRole("heading", { name: "예전 동화" })).toBeNull();
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "empty" },
    });
    expect(screen.getByRole("heading", { name: "빈 기록" })).toBeTruthy();
    expect(screen.getByText("내용이 없는 기록")).toBeTruthy();
    expect(screen.queryByText("저장된 동화")).toBeNull();
  });
  it("does not show a previous account's delayed shelf response", async () => {
    const old = deferred<unknown[]>();
    mocks.threads.mockReturnValueOnce(old.promise).mockResolvedValueOnce([]);
    render(<MyStory />);
    act(() => signIn("new-owner"));
    await screen.findByText("첫 번째 이야기를 기다리고 있어요.");
    await act(async () =>
      old.resolve([
        {
          id: 99,
          created_at: "2026-01-01",
          raw_text: JSON.stringify({ ...book(), title: "이전 계정 비공개 책" }),
        },
      ]),
    );
    expect(screen.queryByText("이전 계정 비공개 책")).toBeNull();
  });
  it("ignores a profile save response after the account changes", async () => {
    const pending = deferred<void>();
    mocks.updateName.mockReturnValue(pending.promise);
    render(<ProfilePage />);
    const name = await screen.findByRole("textbox", { name: "이름" });
    fireEvent.change(name, { target: { value: "바꾼 이름" } });
    fireEvent.submit(name.closest("form")!);
    mocks.profile.mockResolvedValue({
      ...profile,
      id: "new-owner",
      display_name: "다른 계정",
    });
    act(() => signIn("new-owner"));
    await screen.findByDisplayValue("다른 계정");
    await act(async () => pending.resolve());
    expect(screen.queryByText("이름을 저장했어요.")).toBeNull();
    expect(screen.getByDisplayValue("다른 계정")).toBeTruthy();
  });
  it("distinguishes a failed payment config request and lets it recover", async () => {
    mocks.fetch
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(Response.json({ enabled: false }));
    render(<BeadPage />);
    await screen.findByRole("button", { name: "다시 확인하기" });
    expect(screen.queryByText(/곶감 충전은 준비 중이에요/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "다시 확인하기" }));
    await screen.findByText(/곶감 충전은 준비 중이에요/);
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("does not open the payment window after leaving the purchase page", async () => {
    mocks.fetch.mockResolvedValue(Response.json({ enabled: true }));
    const order = deferred<{ orderId: string; amount: number }>();
    mocks.purchase.mockReturnValue(order.promise);
    const { unmount } = render(<BeadPage />);
    fireEvent.click(
      await screen.findByRole("button", { name: "load payment SDK" }),
    );
    fireEvent.click(screen.getAllByRole("button", { name: "충전하기" })[0]);
    await waitFor(() => expect(mocks.purchase).toHaveBeenCalledOnce());
    unmount();
    await act(async () =>
      order.resolve({ orderId: "test-order", amount: 2500 }),
    );
    expect(mocks.requestPayment).not.toHaveBeenCalled();
  });
});
