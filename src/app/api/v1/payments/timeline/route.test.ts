import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authenticateRequestMock,
  getPaymentByOrderIdMock,
  getLatestPaymentByFlowIdMock,
  listWebhookTransmissionsByOrderMock,
  checkRateLimitMock,
  createAdminMock,
} = vi.hoisted(() => ({
  authenticateRequestMock: vi.fn(),
  getPaymentByOrderIdMock: vi.fn(),
  getLatestPaymentByFlowIdMock: vi.fn(),
  listWebhookTransmissionsByOrderMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  createAdminMock: vi.fn(),
}));

vi.mock("@/lib/auth/request-auth", () => ({
  authenticateRequest: authenticateRequestMock,
}));

vi.mock("@/lib/server/payment-service", () => ({
  getPaymentByOrderId: getPaymentByOrderIdMock,
  getLatestPaymentByFlowId: getLatestPaymentByFlowIdMock,
  listWebhookTransmissionsByOrder: listWebhookTransmissionsByOrderMock,
}));

vi.mock("@/lib/server/rate-limit", () => ({
  checkRateLimit: checkRateLimitMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: createAdminMock,
}));

async function loadGetHandler() {
  const routeModule = await import("./route");
  return routeModule.GET;
}

function makeGetRequest(query: Record<string, string | number | undefined>): {
  headers: Headers;
  url: string;
} {
  const search = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined) {
      search.set(key, String(value));
    }
  });
  return {
    headers: new Headers(),
    url: `http://localhost/api/v1/payments/timeline?${search.toString()}`,
  };
}

describe("GET /api/v1/payments/timeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkRateLimitMock.mockReturnValue(true);
    createAdminMock.mockReturnValue({ from: vi.fn(), rpc: vi.fn() });
  });

  it("returns 401 when unauthorized", async () => {
    authenticateRequestMock.mockResolvedValue(null);
    const GET = await loadGetHandler();

    const response = await GET(makeGetRequest({ orderId: "order_1" }) as never);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      error: "Unauthorized",
      code: "AUTH_UNAUTHORIZED",
    });
  });

  it("returns 401 when authenticateRequest throws", async () => {
    authenticateRequestMock.mockRejectedValue(new Error("auth transport down"));
    const GET = await loadGetHandler();

    const response = await GET(makeGetRequest({ orderId: "order_1" }) as never);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      error: "Unauthorized",
      code: "AUTH_UNAUTHORIZED",
    });
  });

  it("returns 429 when rate limit is exceeded", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    checkRateLimitMock.mockReturnValue(false);
    const GET = await loadGetHandler();

    const response = await GET(makeGetRequest({ orderId: "order_1" }) as never);
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toEqual({
      error: "Too many payment timeline requests",
      code: "PAYMENTS_TIMELINE_RATE_LIMITED",
    });
  });

  it("returns 400 when orderId is missing", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    const GET = await loadGetHandler();

    const response = await GET(makeGetRequest({}) as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: "orderId or paymentFlowId is required",
      code: "ORDER_ID_REQUIRED",
    });
  });

  it("returns timeline when paymentFlowId is provided", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    getLatestPaymentByFlowIdMock.mockResolvedValue({
      id: "payment-2",
      user_id: "user-1",
      order_id: "order_flow_1",
      payment_key: "pay_flow_1",
      payment_flow_id: "flow:1",
      amount: 5000,
      bead_quantity: 10,
      status: "completed",
      created_at: "2026-04-05T00:00:00.000Z",
      completed_at: "2026-04-05T00:01:00.000Z",
    });
    listWebhookTransmissionsByOrderMock.mockResolvedValue([]);

    const GET = await loadGetHandler();
    const response = await GET(
      makeGetRequest({ paymentFlowId: "flow:1" }) as never,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getLatestPaymentByFlowIdMock).toHaveBeenCalledWith(
      expect.any(Object),
      "user-1",
      "flow:1",
    );
    expect(body).toEqual(
      expect.objectContaining({
        orderId: "order_flow_1",
        paymentFlowId: "flow:1",
        status: "completed",
      }),
    );
    expect(response.headers.get("x-hodam-payment-timeline-lookup-mode")).toBe(
      "payment_flow_id",
    );
  });

  it("accepts flowId alias query when paymentFlowId is absent", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    getLatestPaymentByFlowIdMock.mockResolvedValue({
      id: "payment-2",
      user_id: "user-1",
      order_id: "order_flow_alias_1",
      payment_key: "pay_flow_1",
      payment_flow_id: "flow:alias:1",
      amount: 5000,
      bead_quantity: 10,
      status: "completed",
      created_at: "2026-04-05T00:00:00.000Z",
      completed_at: "2026-04-05T00:01:00.000Z",
    });
    listWebhookTransmissionsByOrderMock.mockResolvedValue([]);

    const GET = await loadGetHandler();
    const response = await GET({
      headers: new Headers(),
      url: "http://localhost/api/v1/payments/timeline?flowId=flow:alias:1",
    } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getLatestPaymentByFlowIdMock).toHaveBeenCalledWith(
      expect.any(Object),
      "user-1",
      "flow:alias:1",
    );
    expect(body).toEqual(
      expect.objectContaining({
        orderId: "order_flow_alias_1",
        paymentFlowId: "flow:alias:1",
      }),
    );
    expect(response.headers.get("x-hodam-payment-timeline-lookup-mode")).toBe(
      "payment_flow_id",
    );
  });

  it("returns 404 when payment is missing", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    getPaymentByOrderIdMock.mockResolvedValue(null);
    const GET = await loadGetHandler();

    const response = await GET(makeGetRequest({ orderId: "order_1" }) as never);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({
      error: "Payment record not found",
      code: "PAYMENT_NOT_FOUND",
    });
  });

  it("returns 403 when payment belongs to another user", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    getPaymentByOrderIdMock.mockResolvedValue({
      id: "payment-1",
      user_id: "user-2",
      order_id: "order_1",
      amount: 5000,
      bead_quantity: 10,
      status: "pending",
      created_at: "2026-04-05T00:00:00.000Z",
    });
    const GET = await loadGetHandler();

    const response = await GET(makeGetRequest({ orderId: "order_1" }) as never);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      error: "Payment does not belong to current user",
      code: "PAYMENT_USER_MISMATCH",
    });
  });

  it("returns payment timeline with webhook events", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    getPaymentByOrderIdMock.mockResolvedValue({
      id: "payment-1",
      user_id: "user-1",
      order_id: "order_1",
      payment_key: "pay_1",
      payment_flow_id: "order:order_1",
      amount: 5000,
      bead_quantity: 10,
      status: "completed",
      created_at: "2026-04-05T00:00:00.000Z",
      completed_at: "2026-04-05T00:01:00.000Z",
    });
    listWebhookTransmissionsByOrderMock.mockResolvedValue([
      {
        transmission_id: "tx-1",
        order_id: "order_1",
        event_type: "PAYMENT_STATUS_CHANGED",
        transmission_time: "2026-04-05T00:00:30.000Z",
        retried_count: 0,
        created_at: "2026-04-05T00:00:31.000Z",
      },
    ]);

    const GET = await loadGetHandler();
    const response = await GET(makeGetRequest({ orderId: "order_1" }) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        orderId: "order_1",
        status: "completed",
        paymentFlowId: "order:order_1",
      }),
    );
    expect(body.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "payment_created",
        }),
        expect.objectContaining({
          type: "payment_completed",
        }),
        expect.objectContaining({
          type: "webhook_received",
        }),
      ]),
    );
    expect(response.headers.get("x-hodam-payment-flow-id")).toBe(
      "order:order_1",
    );
    expect(response.headers.get("x-hodam-payment-timeline-lookup-mode")).toBe(
      "order_id",
    );
    expect(response.headers.get("x-hodam-payment-timeline-degraded")).toBe("0");
    expect(
      response.headers.get("x-hodam-payment-timeline-degraded-reason"),
    ).toBe("");
  });

  it("falls back to caller flow id when payment history flow id is missing", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    getPaymentByOrderIdMock.mockResolvedValue({
      id: "payment-1",
      user_id: "user-1",
      order_id: "order_1",
      amount: 5000,
      bead_quantity: 10,
      status: "pending",
      created_at: "2026-04-05T00:00:00.000Z",
    });
    listWebhookTransmissionsByOrderMock.mockResolvedValue([]);

    const GET = await loadGetHandler();
    const response = await GET({
      headers: new Headers({
        "x-hodam-payment-flow-id": "flow_timeline_1",
      }),
      url: "http://localhost/api/v1/payments/timeline?orderId=order_1",
    } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        paymentFlowId: "flow_timeline_1",
      }),
    );
    expect(response.headers.get("x-hodam-payment-flow-id")).toBe(
      "flow_timeline_1",
    );
  });

  it("degrades gracefully when webhook transmissions are not readable", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    getPaymentByOrderIdMock.mockResolvedValue({
      id: "payment-1",
      user_id: "user-1",
      order_id: "order_1",
      amount: 5000,
      bead_quantity: 10,
      status: "pending",
      created_at: "2026-04-05T00:00:00.000Z",
    });
    listWebhookTransmissionsByOrderMock.mockRejectedValue({
      code: "42501",
      message: "permission denied for table payment_webhook_transmissions",
    });

    const GET = await loadGetHandler();
    const response = await GET(makeGetRequest({ orderId: "order_1" }) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.events).toEqual([
      expect.objectContaining({
        type: "payment_created",
      }),
    ]);
    expect(response.headers.get("x-hodam-payment-timeline-degraded")).toBe("1");
    expect(
      response.headers.get("x-hodam-payment-timeline-degraded-reason"),
    ).toBe("webhook_transmissions_permission_denied");
  });

  it("returns 500 when timeline lookup fails", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    getPaymentByOrderIdMock.mockResolvedValue({
      id: "payment-1",
      user_id: "user-1",
      order_id: "order_1",
      amount: 5000,
      bead_quantity: 10,
      status: "pending",
      created_at: "2026-04-05T00:00:00.000Z",
    });
    listWebhookTransmissionsByOrderMock.mockRejectedValue(
      new Error("db failure"),
    );

    const GET = await loadGetHandler();
    const response = await GET(makeGetRequest({ orderId: "order_1" }) as never);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: "Failed to fetch payment timeline",
      code: "PAYMENTS_TIMELINE_FETCH_FAILED",
    });
  });
});
