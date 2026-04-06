import { beforeEach, describe, expect, it, vi } from "vitest";

import beadApi from "@/lib/client/api/bead";

const { authorizedFetchMock, paymentApiMock } = vi.hoisted(() => ({
  authorizedFetchMock: vi.fn(),
  paymentApiMock: {
    preparePayment: vi.fn(),
    confirmPayment: vi.fn(),
    getPaymentHistory: vi.fn(),
    getPaymentStatus: vi.fn(),
  },
}));

vi.mock("@/lib/client/api/http", () => ({
  authorizedFetch: authorizedFetchMock,
}));

vi.mock("@/lib/client/api/payment", () => ({
  default: paymentApiMock,
}));

describe("beadApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads bead state from /api/v1/beads", async () => {
    authorizedFetchMock.mockResolvedValue({
      bead: {
        id: "bead-1",
        user_id: "user-1",
        count: 12,
      },
    });

    const bead = await beadApi.initializeBead();

    expect(bead).toEqual(
      expect.objectContaining({
        id: "bead-1",
        user_id: "user-1",
        count: 12,
      }),
    );
    expect(authorizedFetchMock).toHaveBeenCalledWith(
      "/api/v1/beads",
      {
        method: "GET",
      },
      expect.anything(),
    );
  });

  it("prepares payment using mapped package id", async () => {
    paymentApiMock.preparePayment.mockResolvedValue({
      orderId: "order-1",
      amount: 5000,
    });

    const prepared = await beadApi.purchaseBeads(10, 5000);

    expect(prepared).toEqual({ orderId: "order-1", amount: 5000 });
    expect(paymentApiMock.preparePayment).toHaveBeenCalledWith("bead_10");
  });

  it("throws when package mapping is unknown", async () => {
    await expect(beadApi.purchaseBeads(999, 99999)).rejects.toThrow(
      "지원하지 않는 결제 패키지입니다.",
    );
    expect(paymentApiMock.preparePayment).not.toHaveBeenCalled();
  });

  it("completes payment and returns updated bead count from confirm response", async () => {
    paymentApiMock.confirmPayment.mockResolvedValue({
      success: true,
      beadCount: 20,
    });
    authorizedFetchMock.mockResolvedValue({
      bead: {
        id: "bead-1",
        user_id: "user-1",
        count: 10,
      },
    });

    const bead = await beadApi.completeBeadPurchase("pay-1", "order-1", 5000);

    expect(bead.count).toBe(20);
  });

  it("throws when confirm payment fails", async () => {
    paymentApiMock.confirmPayment.mockResolvedValue({
      success: false,
      error: "confirm failed",
    });
    paymentApiMock.getPaymentStatus.mockResolvedValue({
      orderId: "order-1",
      status: "failed",
      amount: 5000,
      beadQuantity: 10,
      reconciliationState: "not_attempted",
    });

    await expect(
      beadApi.completeBeadPurchase("pay-1", "order-1", 5000),
    ).rejects.toThrow("confirm failed");
  });

  it("recovers completed payment through status API when confirm fails", async () => {
    paymentApiMock.confirmPayment.mockResolvedValue({
      success: false,
      error: "temporary provider error",
    });
    paymentApiMock.getPaymentStatus.mockResolvedValue({
      orderId: "order-1",
      status: "completed",
      amount: 5000,
      beadQuantity: 10,
      beadCount: 42,
      reconciliationState: "settled",
    });
    authorizedFetchMock.mockResolvedValue({
      bead: {
        id: "bead-1",
        user_id: "user-1",
        count: 10,
      },
    });

    const bead = await beadApi.completeBeadPurchase("pay-1", "order-1", 5000);
    expect(bead.count).toBe(42);
  });

  it("throws pending message when status API says payment is still pending", async () => {
    paymentApiMock.confirmPayment.mockResolvedValue({
      success: false,
      error: "temporary provider error",
    });
    paymentApiMock.getPaymentStatus.mockResolvedValue({
      orderId: "order-1",
      status: "pending",
      amount: 5000,
      beadQuantity: 10,
      reconciliationState: "pending",
    });

    await expect(
      beadApi.completeBeadPurchase("pay-1", "order-1", 5000),
    ).rejects.toThrow("결제가 아직 처리 중입니다. 잠시 후 다시 확인해주세요.");
  });

  it("returns payment history via paymentApi", async () => {
    paymentApiMock.getPaymentHistory.mockResolvedValue([{ id: "payment-1" }]);

    const history = await beadApi.getPaymentHistory();

    expect(history).toEqual([{ id: "payment-1" }]);
  });

  it("returns a safe copy of bead packages", () => {
    const packagesA = beadApi.getBeadPackages();
    const packagesB = beadApi.getBeadPackages();

    expect(packagesA).not.toBe(packagesB);
    expect(packagesA.length).toBeGreaterThan(0);
  });
});
