import { beforeEach, describe, expect, it, vi } from "vitest";

import paymentApi from "@/lib/client/api/payment";

const { authorizedFetchMock } = vi.hoisted(() => ({
  authorizedFetchMock: vi.fn(),
}));

vi.mock("@/lib/client/api/http", () => ({
  ApiError: class MockApiError extends Error {
    status: number;

    code?: string;

    constructor(
      status: number,
      message: string,
      details?: { code?: string } | null,
    ) {
      super(message);
      this.status = status;
      this.code = details?.code;
    }
  },
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

  it("forwards payment flow id header on confirm", async () => {
    authorizedFetchMock.mockResolvedValue({
      success: true,
      paymentKey: "pay-1",
      orderId: "order-1",
      amount: 5000,
      beadCount: 10,
      alreadyProcessed: false,
      paymentFlowId: "flow_confirm_1",
    });

    const result = await paymentApi.confirmPayment("pay-1", "order-1", 5000, {
      paymentFlowId: "flow_confirm_1",
    });

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        paymentFlowId: "flow_confirm_1",
      }),
    );
    expect(authorizedFetchMock).toHaveBeenCalledWith(
      "/api/v1/payments/confirm",
      {
        method: "POST",
        headers: {
          "x-hodam-payment-flow-id": "flow_confirm_1",
        },
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
      errorCode: undefined,
      errorStatus: undefined,
    });
  });

  it("returns failure result with error code when confirm API throws ApiError", async () => {
    const { ApiError } = await import("@/lib/client/api/http");
    authorizedFetchMock.mockRejectedValue(
      new ApiError(429, "Too many requests", {
        code: "PAYMENTS_CONFIRM_RATE_LIMITED",
      }),
    );

    const result = await paymentApi.confirmPayment("pay-1", "order-1", 5000);

    expect(result).toEqual({
      success: false,
      error: "Too many requests",
      errorCode: "PAYMENTS_CONFIRM_RATE_LIMITED",
      errorStatus: 429,
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

  it("forwards payment flow id header on payment status query", async () => {
    authorizedFetchMock.mockResolvedValue({
      orderId: "order-1",
      status: "completed",
      amount: 5000,
      beadQuantity: 10,
      reconciliationState: "settled",
      paymentFlowId: "flow_status_1",
    });

    const status = await paymentApi.getPaymentStatus("order-1", {
      paymentFlowId: "flow_status_1",
    });

    expect(status).toEqual(
      expect.objectContaining({
        paymentFlowId: "flow_status_1",
      }),
    );
    expect(authorizedFetchMock).toHaveBeenCalledWith(
      "/api/v1/payments/status?orderId=order-1",
      {
        method: "GET",
        headers: {
          "x-hodam-payment-flow-id": "flow_status_1",
        },
      },
      expect.anything(),
    );
  });

  it("fetches payment timeline by orderId with optional flow header", async () => {
    authorizedFetchMock.mockResolvedValue({
      orderId: "order-1",
      status: "completed",
      amount: 5000,
      beadQuantity: 10,
      paymentFlowId: "flow_timeline_1",
      events: [
        {
          type: "payment_created",
          source: "payment_history",
          timestamp: "2026-04-05T00:00:00.000Z",
        },
      ],
    });

    const timeline = await paymentApi.getPaymentTimeline(
      { orderId: "order-1" },
      {
        paymentFlowId: "flow_timeline_1",
      },
    );

    expect(timeline).toEqual(
      expect.objectContaining({
        orderId: "order-1",
        paymentFlowId: "flow_timeline_1",
      }),
    );
    expect(authorizedFetchMock).toHaveBeenCalledWith(
      "/api/v1/payments/timeline?orderId=order-1",
      {
        method: "GET",
        headers: {
          "x-hodam-payment-flow-id": "flow_timeline_1",
        },
      },
      expect.anything(),
    );
  });

  it("fetches payment timeline by paymentFlowId", async () => {
    authorizedFetchMock.mockResolvedValue({
      orderId: "order-2",
      status: "completed",
      amount: 5000,
      beadQuantity: 10,
      paymentFlowId: "flow_timeline_1",
      events: [
        {
          type: "payment_created",
          source: "payment_history",
          timestamp: "2026-04-05T00:00:00.000Z",
        },
      ],
    });

    const timeline = await paymentApi.getPaymentTimeline({
      paymentFlowId: "flow_timeline_1",
    });

    expect(timeline).toEqual(
      expect.objectContaining({
        orderId: "order-2",
        paymentFlowId: "flow_timeline_1",
      }),
    );
    expect(authorizedFetchMock).toHaveBeenCalledWith(
      "/api/v1/payments/timeline?paymentFlowId=flow_timeline_1",
      {
        method: "GET",
        headers: {
          "x-hodam-payment-flow-id": "flow_timeline_1",
        },
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
