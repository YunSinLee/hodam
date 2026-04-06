import { beforeEach, describe, expect, it, vi } from "vitest";

import paymentApi from "@/lib/client/api/payment";

const { authorizedFetchMock } = vi.hoisted(() => ({
  authorizedFetchMock: vi.fn(),
}));

vi.mock("@/lib/client/api/http", () => ({
  authorizedFetch: authorizedFetchMock,
}));

describe("paymentApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prepares payment through v1 endpoint", async () => {
    authorizedFetchMock.mockResolvedValue({
      orderId: "order-1",
      amount: 5000,
      orderName: "곶감 10개",
      package: { id: "bead_10", quantity: 10, price: 5000 },
    });

    const result = await paymentApi.preparePayment("bead_10");

    expect(result.orderId).toBe("order-1");
    expect(authorizedFetchMock).toHaveBeenCalledWith(
      "/api/v1/payments/prepare",
      {
        method: "POST",
        body: JSON.stringify({ packageId: "bead_10" }),
      },
      expect.anything(),
    );
  });

  it("creates legacy payment request from package mapping", async () => {
    authorizedFetchMock.mockResolvedValue({
      orderId: "order-legacy-1",
      amount: 5000,
      orderName: "곶감 10개",
      package: { id: "bead_10", quantity: 10, price: 5000 },
    });

    const result = await paymentApi.createPaymentRequest({
      amount: 5000,
      orderId: "",
      orderName: "",
      customerEmail: "user@example.com",
      customerName: "user",
      beadQuantity: 10,
      userId: "user-1",
    });

    expect(result).toEqual({
      orderId: "order-legacy-1",
      amount: 5000,
    });
  });

  it("confirms payment and returns mapped success result", async () => {
    authorizedFetchMock.mockResolvedValue({
      success: true,
      paymentKey: "pay-1",
      orderId: "order-1",
      amount: 5000,
      beadCount: 10,
      alreadyProcessed: false,
    });

    const result = await paymentApi.confirmPayment("pay-1", "order-1", 5000);

    expect(result).toEqual({
      success: true,
      paymentKey: "pay-1",
      orderId: "order-1",
      amount: 5000,
      beadCount: 10,
      alreadyProcessed: false,
    });
    expect(authorizedFetchMock).toHaveBeenCalledWith(
      "/api/v1/payments/confirm",
      {
        method: "POST",
        body: JSON.stringify({
          paymentKey: "pay-1",
          orderId: "order-1",
          amount: 5000,
        }),
      },
      expect.anything(),
    );
  });

  it("returns failure result when confirm API throws", async () => {
    authorizedFetchMock.mockRejectedValue(new Error("confirm failed"));

    const result = await paymentApi.confirmPayment("pay-1", "order-1", 5000);

    expect(result).toEqual({
      success: false,
      error: "confirm failed",
    });
  });

  it("returns payment history and normalizes missing payments", async () => {
    authorizedFetchMock
      .mockResolvedValueOnce({
        payments: [{ id: "1", order_id: "order-1" }],
      })
      .mockResolvedValueOnce({});

    const history = await paymentApi.getPaymentHistory();
    const fallbackHistory = await paymentApi.getPaymentHistory();

    expect(history).toHaveLength(1);
    expect(fallbackHistory).toEqual([]);
  });

  it("fetches payment status for reconciliation", async () => {
    authorizedFetchMock.mockResolvedValue({
      orderId: "order-1",
      status: "pending",
      amount: 5000,
      beadQuantity: 10,
      reconciliationState: "pending",
    });

    const status = await paymentApi.getPaymentStatus("order-1", {
      paymentKey: "pay-1",
      amount: 5000,
    });

    expect(status).toEqual(
      expect.objectContaining({
        orderId: "order-1",
        status: "pending",
      }),
    );
    expect(authorizedFetchMock).toHaveBeenCalledWith(
      "/api/v1/payments/status?orderId=order-1&paymentKey=pay-1&amount=5000",
      {
        method: "GET",
      },
      expect.anything(),
    );
  });

  it("throws when package mapping is not found", () => {
    expect(() => paymentApi.resolvePackageId(999, 999999)).toThrow(
      "지원하지 않는 결제 패키지입니다.",
    );
  });
});
