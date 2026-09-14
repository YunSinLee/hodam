import { beforeEach, describe, expect, it, vi } from "vitest";

import beadApi from "@/app/api/bead";
import paymentApi from "@/app/api/payment";
import profileApi from "@/app/api/profile";

const { bead, payment, profile } = vi.hoisted(() => ({
  bead: {
    initializeBead: vi.fn(),
    purchaseBeads: vi.fn(),
    completeBeadPurchase: vi.fn(),
    getPaymentHistory: vi.fn(),
  },
  payment: { getPaymentHistory: vi.fn() },
  profile: {
    getProfileSummary: vi.fn(),
    updateDisplayName: vi.fn(),
    uploadProfileImage: vi.fn(),
    removeCustomProfileImage: vi.fn(),
  },
}));

vi.mock("@/lib/client/api/bead", () => ({ default: bead }));
vi.mock("@/lib/client/api/payment", () => ({ default: payment }));
vi.mock("@/lib/client/api/profile", () => ({ default: profile }));

beforeEach(() => vi.resetAllMocks());

describe("picturebook API compatibility", () => {
  it("prepares canonical packages without sending legacy client identity", async () => {
    bead.purchaseBeads.mockResolvedValue({ orderId: "order-1", amount: 2500 });
    await expect(
      beadApi.purchaseBeads("user-1", "user@example.com", "이름", 5, 2500),
    ).resolves.toEqual({ orderId: "order-1", amount: 2500 });
    expect(bead.purchaseBeads).toHaveBeenCalledExactlyOnceWith(5, 2500);
  });

  it("does not confuse legacy user id with a payment flow id", async () => {
    bead.completeBeadPurchase.mockResolvedValue({
      user_id: "user-1",
      count: 5,
    });
    await beadApi.completeBeadPurchase("key", "order", 2500, "user-1");
    expect(bead.completeBeadPurchase).toHaveBeenCalledExactlyOnceWith(
      "key",
      "order",
      2500,
    );
  });

  it("uses the authenticated session for balance and payment history", async () => {
    bead.initializeBead.mockResolvedValue({ user_id: "user-1", count: 5 });
    payment.getPaymentHistory.mockResolvedValue([]);
    await beadApi.initializeBead("user-1");
    await paymentApi.getPaymentHistory("user-1");
    expect(bead.initializeBead).toHaveBeenCalledExactlyOnceWith();
    expect(payment.getPaymentHistory).toHaveBeenCalledExactlyOnceWith();
  });

  it("returns signed profile summary data only for the active account", async () => {
    const current = {
      id: "user-1",
      profileUrl: "https://signed.example/image",
      custom_profile_url: "profiles:profile_user-1_id.png",
    };
    profile.getProfileSummary.mockResolvedValue({ profile: current });
    await expect(profileApi.getUserProfile("user-1")).resolves.toEqual(current);
    await expect(profileApi.getUserProfile("user-2")).rejects.toThrow(
      "로그인 정보를 확인해주세요.",
    );
  });

  it("does not report a profile image upload as successful when no URL was saved", async () => {
    profile.uploadProfileImage.mockResolvedValue(null);
    await expect(
      profileApi.uploadProfileImage("user-1", new File(["x"], "test.png")),
    ).rejects.toThrow("사진을 올리지 못했어요.");
  });

  it("rejects unsuccessful profile mutations and validates the QA name limit", async () => {
    profile.updateDisplayName.mockResolvedValue(false);
    profile.removeCustomProfileImage.mockResolvedValue(false);
    await expect(
      profileApi.updateDisplayName("user-1", "호담"),
    ).rejects.toThrow();
    await expect(profileApi.updateDisplayName("user-1", " ")).rejects.toThrow(
      "1~30자",
    );
    await expect(
      profileApi.updateDisplayName("user-1", "가".repeat(31)),
    ).rejects.toThrow("1~30자");
    await expect(
      profileApi.removeCustomProfileImage("user-1"),
    ).rejects.toThrow();
    expect(profile.updateDisplayName).toHaveBeenCalledExactlyOnceWith(
      "user-1",
      "호담",
    );
  });
});
