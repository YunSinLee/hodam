import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), getUser: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));
import { requireServerUser } from "../src/app/api/server-auth";

beforeEach(() => {
  mocks.createClient
    .mockReset()
    .mockReturnValue({ auth: { getUser: mocks.getUser } });
  mocks.getUser
    .mockReset()
    .mockResolvedValue({ data: { user: { id: "owner" } }, error: null });
});
describe("server authentication boundary", () => {
  it.each([
    undefined,
    "",
    " ",
    "token\nsecond-line",
    " bearer ",
    "x".repeat(8193),
    42,
  ])(
    "rejects malformed credentials before creating authorization headers",
    async token => {
      await expect(requireServerUser(token as string)).rejects.toThrow(
        "로그인이 필요합니다",
      );
      expect(mocks.createClient).not.toHaveBeenCalled();
    },
  );
  it("verifies the token remotely and binds it to the scoped client", async () => {
    const result = await requireServerUser("test.token.signature");
    expect(result.user.id).toBe("owner");
    expect(mocks.getUser).toHaveBeenCalledWith("test.token.signature");
    expect(mocks.createClient.mock.calls[0][2]).toMatchObject({
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: "Bearer test.token.signature" } },
    });
  });
  it("rejects expired or invalid remote sessions", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "invalid session" },
    });
    await expect(requireServerUser("token")).rejects.toThrow(
      "다시 로그인해주세요",
    );
  });
  it("does not expose low-level transport failures to the user", async () => {
    mocks.getUser.mockRejectedValue(
      new Error("internal network credentials detail"),
    );
    await expect(requireServerUser("token")).rejects.toThrow(
      "로그인을 확인하지 못했어요",
    );
  });
});
