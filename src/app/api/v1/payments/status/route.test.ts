import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  authenticateRequestMock,
  getOptionalEnvMock,
  getRequiredEnvMock,
  getPaymentByOrderIdMock,
  settlePaymentAndCreditMock,
  checkRateLimitMock,
  createAdminMock,
} = vi.hoisted(() => ({
  authenticateRequestMock: vi.fn(),
  getOptionalEnvMock: vi.fn(),
  getRequiredEnvMock: vi.fn(),
  getPaymentByOrderIdMock: vi.fn(),
  settlePaymentAndCreditMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  createAdminMock: vi.fn(),
}));

class PaymentDomainErrorMock extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "PaymentDomainError";
    this.code = code;
  }
}

vi.mock("@/lib/auth/request-auth", () => ({
  authenticateRequest: authenticateRequestMock,
}));

vi.mock("@/lib/env", () => ({
  getOptionalEnv: getOptionalEnvMock,
  getRequiredEnv: getRequiredEnvMock,
}));

vi.mock("@/lib/server/payment-service", () => ({
  getPaymentByOrderId: getPaymentByOrderIdMock,
  PaymentDomainError: PaymentDomainErrorMock,
  settlePaymentAndCredit: settlePaymentAndCreditMock,
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
    url: `http://localhost/api/v1/payments/status?${search.toString()}`,
  };
}

describe("GET /api/v1/payments/status", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    checkRateLimitMock.mockReturnValue(true);
    createAdminMock.mockReturnValue({ from: vi.fn(), rpc: vi.fn() });
    getOptionalEnvMock.mockImplementation((key: string) => {
      if (key === "TOSS_PAYMENTS_SECRET_KEY") {
        return "toss_test_secret";
      }
      return undefined;
    });
    getRequiredEnvMock.mockImplementation((key: string) => {
      if (key === "TOSS_PAYMENTS_SECRET_KEY") {
        return "toss_test_secret";
      }
      throw new Error(`unexpected required env key: ${key}`);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 401 when unauthorized", async () => {
    authenticateRequestMock.mockResolvedValue(null);
    const GET = await loadGetHandler();

    const response = await GET(makeGetRequest({ orderId: "order_1" }) as never);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get("x-request-id")).toMatch(
      /[A-Za-z0-9._:-]{1,128}/,
    );
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
      error: "Too many payment status requests",
      code: "PAYMENTS_STATUS_RATE_LIMITED",
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
      error: "orderId is required",
      code: "ORDER_ID_REQUIRED",
    });
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

  it("returns completed status without reconciliation", async () => {
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
      payment_key: "pay_1",
      status: "completed",
      created_at: "2026-04-05T00:00:00.000Z",
      completed_at: "2026-04-05T00:01:00.000Z",
    });
    const GET = await loadGetHandler();

    const response = await GET(makeGetRequest({ orderId: "order_1" }) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        orderId: "order_1",
        status: "completed",
        paymentKey: "pay_1",
        paymentFlowId: "order:order_1",
        reconciliationState: "not_attempted",
      }),
    );
    expect(response.headers.get("x-hodam-payment-flow-id")).toBe(
      "order:order_1",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserves caller payment flow id header", async () => {
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
      payment_key: "pay_1",
      status: "completed",
      created_at: "2026-04-05T00:00:00.000Z",
      completed_at: "2026-04-05T00:01:00.000Z",
    });
    const GET = await loadGetHandler();

    const response = await GET({
      headers: new Headers({
        "x-hodam-payment-flow-id": "flow_status_1",
      }),
      url: "http://localhost/api/v1/payments/status?orderId=order_1",
    } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        paymentFlowId: "flow_status_1",
      }),
    );
    expect(response.headers.get("x-hodam-payment-flow-id")).toBe(
      "flow_status_1",
    );
  });

  it("returns pending when provider status is not DONE", async () => {
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
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        status: "IN_PROGRESS",
        totalAmount: 5000,
      }),
    });
    const GET = await loadGetHandler();

    const response = await GET(makeGetRequest({ orderId: "order_1" }) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        status: "pending",
        providerStatus: "IN_PROGRESS",
        reconciliationState: "pending",
      }),
    );
    expect(settlePaymentAndCreditMock).not.toHaveBeenCalled();
  });

  it("reconciles pending payment when provider status is DONE", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    getPaymentByOrderIdMock
      .mockResolvedValueOnce({
        id: "payment-1",
        user_id: "user-1",
        order_id: "order_1",
        amount: 5000,
        bead_quantity: 10,
        status: "pending",
        created_at: "2026-04-05T00:00:00.000Z",
      })
      .mockResolvedValueOnce({
        id: "payment-1",
        user_id: "user-1",
        order_id: "order_1",
        amount: 5000,
        bead_quantity: 10,
        payment_key: "pay_1",
        status: "completed",
        created_at: "2026-04-05T00:00:00.000Z",
        completed_at: "2026-04-05T00:01:00.000Z",
      });
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        status: "DONE",
        paymentKey: "pay_1",
        totalAmount: 5000,
      }),
    });
    settlePaymentAndCreditMock.mockResolvedValue({
      beadCount: 25,
      alreadyProcessed: false,
    });

    const GET = await loadGetHandler();
    const response = await GET(makeGetRequest({ orderId: "order_1" }) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(settlePaymentAndCreditMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        order_id: "order_1",
      }),
      "pay_1",
    );
    expect(body).toEqual(
      expect.objectContaining({
        status: "completed",
        beadCount: 25,
        alreadyProcessed: false,
        reconciliationState: "settled",
      }),
    );
  });

  it("returns amount_mismatch reconciliation state when provider amount mismatches", async () => {
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
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        status: "DONE",
        paymentKey: "pay_1",
        totalAmount: 7000,
      }),
    });
    const GET = await loadGetHandler();

    const response = await GET(makeGetRequest({ orderId: "order_1" }) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        status: "pending",
        reconciliationState: "amount_mismatch",
      }),
    );
    expect(settlePaymentAndCreditMock).not.toHaveBeenCalled();
  });

  it("maps payment domain state conflict to 409", async () => {
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
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        status: "DONE",
        paymentKey: "pay_1",
        totalAmount: 5000,
      }),
    });
    settlePaymentAndCreditMock.mockRejectedValue(
      new PaymentDomainErrorMock("PAYMENT_INVALID_STATUS_TRANSITION"),
    );

    const GET = await loadGetHandler();
    const response = await GET(makeGetRequest({ orderId: "order_1" }) as never);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      error: "Payment state conflict",
      code: "PAYMENT_STATE_CONFLICT",
    });
  });
});
