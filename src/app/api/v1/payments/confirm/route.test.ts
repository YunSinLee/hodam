import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  authenticateRequestMock,
  getOptionalEnvMock,
  getRequiredEnvMock,
  trackUserActivityBestEffortMock,
  getPaymentByOrderIdMock,
  markPaymentFailedMock,
  settlePaymentAndCreditMock,
  checkRateLimitMock,
  createAdminMock,
} = vi.hoisted(() => ({
  authenticateRequestMock: vi.fn(),
  getOptionalEnvMock: vi.fn(),
  getRequiredEnvMock: vi.fn(),
  trackUserActivityBestEffortMock: vi.fn(),
  getPaymentByOrderIdMock: vi.fn(),
  markPaymentFailedMock: vi.fn(),
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

vi.mock("@/lib/server/analytics", () => ({
  trackUserActivityBestEffort: trackUserActivityBestEffortMock,
}));

vi.mock("@/lib/server/payment-service", () => ({
  getPaymentByOrderId: getPaymentByOrderIdMock,
  markPaymentFailed: markPaymentFailedMock,
  PaymentDomainError: PaymentDomainErrorMock,
  settlePaymentAndCredit: settlePaymentAndCreditMock,
}));

vi.mock("@/lib/server/rate-limit", () => ({
  checkRateLimit: checkRateLimitMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: createAdminMock,
}));

async function loadPostHandler() {
  const routeModule = await import("./route");
  return routeModule.POST;
}

describe("POST /api/v1/payments/confirm", () => {
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
    trackUserActivityBestEffortMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 401 when unauthorized", async () => {
    authenticateRequestMock.mockResolvedValue(null);
    const POST = await loadPostHandler();

    const response = await POST({ headers: new Headers() } as never);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get("x-request-id")).toMatch(
      /[A-Za-z0-9._:-]{1,128}/,
    );
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("returns 429 when rate limit is exceeded", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    checkRateLimitMock.mockReturnValue(false);

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({
        paymentKey: "pay_1",
        orderId: "order_1",
        amount: 5000,
      }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toEqual({ error: "Too many payment confirmation requests" });
  });

  it("returns 400 when request body is invalid", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers(),
      json: vi
        .fn()
        .mockResolvedValue({ paymentKey: "", orderId: "", amount: 0 }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: "paymentKey, orderId, amount are required",
    });
  });

  it("returns 400 when request body is not valid JSON", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockRejectedValue(new Error("invalid json")),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Invalid JSON body" });
  });

  it("returns 404 when payment record does not exist", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    getPaymentByOrderIdMock.mockResolvedValue(null);

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({
        paymentKey: "pay_1",
        orderId: "order_1",
        amount: 5000,
      }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: "Payment record not found" });
  });

  it("returns 403 when payment belongs to another user", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    getPaymentByOrderIdMock.mockResolvedValue({
      order_id: "order_1",
      user_id: "user-2",
      amount: 5000,
      bead_quantity: 10,
    });

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({
        paymentKey: "pay_1",
        orderId: "order_1",
        amount: 5000,
      }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: "Payment does not belong to current user" });
  });

  it("returns 400 when amount is mismatched", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    getPaymentByOrderIdMock.mockResolvedValue({
      order_id: "order_1",
      user_id: "user-1",
      amount: 1000,
      bead_quantity: 10,
    });

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({
        paymentKey: "pay_1",
        orderId: "order_1",
        amount: 5000,
      }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Amount mismatch" });
  });

  it("returns 409 when payment is cancelled", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    getPaymentByOrderIdMock.mockResolvedValue({
      order_id: "order_1",
      user_id: "user-1",
      amount: 5000,
      bead_quantity: 10,
      status: "cancelled",
    });

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({
        paymentKey: "pay_1",
        orderId: "order_1",
        amount: 5000,
      }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({ error: "Payment is cancelled" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns already processed success when payment is already completed", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    getPaymentByOrderIdMock.mockResolvedValue({
      order_id: "order_1",
      user_id: "user-1",
      amount: 5000,
      bead_quantity: 10,
      status: "completed",
      completed_at: "2026-04-05T00:00:00.000Z",
    });
    settlePaymentAndCreditMock.mockResolvedValue({
      beadCount: 20,
      alreadyProcessed: true,
    });

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({
        paymentKey: "pay_1",
        orderId: "order_1",
        amount: 5000,
      }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(body).toEqual(
      expect.objectContaining({
        success: true,
        orderId: "order_1",
        alreadyProcessed: true,
        paymentStatus: "DONE",
      }),
    );
  });

  it("marks payment failed when toss confirmation fails", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    getPaymentByOrderIdMock.mockResolvedValue({
      order_id: "order_1",
      user_id: "user-1",
      amount: 5000,
      bead_quantity: 10,
    });
    fetchMock.mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({
        message: "confirmation failed",
        code: "FAILED_PAYMENT_INTERNAL_SYSTEM_PROCESSING",
      }),
    });

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({
        paymentKey: "pay_1",
        orderId: "order_1",
        amount: 5000,
      }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(markPaymentFailedMock).toHaveBeenCalledWith(
      expect.any(Object),
      "order_1",
    );
    expect(body).toEqual({
      error: "confirmation failed",
      code: "FAILED_PAYMENT_INTERNAL_SYSTEM_PROCESSING",
    });
  });

  it("returns 502 and does not mark failed on toss 5xx errors", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    getPaymentByOrderIdMock.mockResolvedValue({
      order_id: "order_1",
      user_id: "user-1",
      amount: 5000,
      bead_quantity: 10,
      status: "pending",
    });
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      json: vi.fn().mockResolvedValue({
        message: "upstream fail",
        code: "INTERNAL_SERVER_ERROR",
      }),
    });

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({
        paymentKey: "pay_1",
        orderId: "order_1",
        amount: 5000,
      }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(markPaymentFailedMock).not.toHaveBeenCalled();
    expect(body).toEqual({
      error: "Payment provider temporary failure",
      code: "INTERNAL_SERVER_ERROR",
    });
  });

  it("returns success when toss says already processed and DB is already completed", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    getPaymentByOrderIdMock
      .mockResolvedValueOnce({
        order_id: "order_1",
        user_id: "user-1",
        amount: 5000,
        bead_quantity: 10,
        status: "pending",
      })
      .mockResolvedValueOnce({
        order_id: "order_1",
        user_id: "user-1",
        amount: 5000,
        bead_quantity: 10,
        status: "completed",
        completed_at: "2026-04-05T00:00:00.000Z",
      });
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: vi.fn().mockResolvedValue({
        message: "already processed",
        code: "ALREADY_PROCESSED_PAYMENT",
      }),
    });
    settlePaymentAndCreditMock.mockResolvedValue({
      beadCount: 10,
      alreadyProcessed: true,
    });

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({
        paymentKey: "pay_1",
        orderId: "order_1",
        amount: 5000,
      }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        success: true,
        alreadyProcessed: true,
      }),
    );
  });

  it("settles payment and returns success response", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    getPaymentByOrderIdMock.mockResolvedValue({
      order_id: "order_1",
      user_id: "user-1",
      amount: 5000,
      bead_quantity: 10,
    });
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        status: "DONE",
        approvedAt: "2026-04-05T00:00:00.000Z",
      }),
    });
    settlePaymentAndCreditMock.mockResolvedValue({
      beadCount: 10,
      alreadyProcessed: false,
    });

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({
        paymentKey: "pay_1",
        orderId: "order_1",
        amount: 5000,
      }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(settlePaymentAndCreditMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        order_id: "order_1",
      }),
      "pay_1",
    );
    expect(trackUserActivityBestEffortMock).toHaveBeenCalledWith(
      expect.any(Object),
      "user-1",
      "purchase_success",
      expect.objectContaining({
        order_id: "order_1",
        bead_count: 10,
      }),
      expect.anything(),
    );
    expect(body).toEqual(
      expect.objectContaining({
        success: true,
        orderId: "order_1",
        beadCount: 10,
        alreadyProcessed: false,
        paymentStatus: "DONE",
      }),
    );
  });

  it("returns alreadyProcessed=true for duplicate confirmation", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    getPaymentByOrderIdMock.mockResolvedValue({
      order_id: "order_1",
      user_id: "user-1",
      amount: 5000,
      bead_quantity: 10,
    });
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        status: "DONE",
        approvedAt: "2026-04-05T00:00:00.000Z",
      }),
    });
    settlePaymentAndCreditMock.mockResolvedValue({
      beadCount: 10,
      alreadyProcessed: true,
    });

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({
        paymentKey: "pay_1",
        orderId: "order_1",
        amount: 5000,
      }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        success: true,
        orderId: "order_1",
        alreadyProcessed: true,
      }),
    );
  });

  it("falls back to required env when optional toss secret is missing", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    getOptionalEnvMock.mockImplementation(() => undefined);
    getRequiredEnvMock.mockReturnValue("toss_test_secret_required");
    getPaymentByOrderIdMock.mockResolvedValue({
      order_id: "order_1",
      user_id: "user-1",
      amount: 5000,
      bead_quantity: 10,
    });
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        status: "DONE",
        approvedAt: "2026-04-05T00:00:00.000Z",
      }),
    });
    settlePaymentAndCreditMock.mockResolvedValue({
      beadCount: 10,
      alreadyProcessed: false,
    });

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({
        paymentKey: "pay_1",
        orderId: "order_1",
        amount: 5000,
      }),
    } as never);

    expect(response.status).toBe(200);
    expect(getRequiredEnvMock).toHaveBeenCalledWith("TOSS_PAYMENTS_SECRET_KEY");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.tosspayments.com/v1/payments/confirm",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: expect.stringContaining("Basic "),
        }),
      }),
    );
  });

  it("uses configured toss api base url for confirm endpoint", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    getOptionalEnvMock.mockImplementation((key: string) => {
      if (key === "TOSS_PAYMENTS_SECRET_KEY") {
        return "toss_test_secret";
      }
      if (key === "TOSS_PAYMENTS_API_BASE_URL") {
        return "https://sandbox.tosspayments.com";
      }
      return undefined;
    });
    getPaymentByOrderIdMock.mockResolvedValue({
      order_id: "order_1",
      user_id: "user-1",
      amount: 5000,
      bead_quantity: 10,
    });
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        status: "DONE",
        approvedAt: "2026-04-05T00:00:00.000Z",
      }),
    });
    settlePaymentAndCreditMock.mockResolvedValue({
      beadCount: 10,
      alreadyProcessed: false,
    });

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({
        paymentKey: "pay_1",
        orderId: "order_1",
        amount: 5000,
      }),
    } as never);

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://sandbox.tosspayments.com/v1/payments/confirm",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  it("returns 500 when toss confirm request throws", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    getPaymentByOrderIdMock.mockResolvedValue({
      order_id: "order_1",
      user_id: "user-1",
      amount: 5000,
      bead_quantity: 10,
    });
    fetchMock.mockRejectedValue(new Error("network failed"));

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({
        paymentKey: "pay_1",
        orderId: "order_1",
        amount: 5000,
      }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "Failed to confirm payment" });
    expect(markPaymentFailedMock).not.toHaveBeenCalled();
  });

  it("maps domain conflict errors to 409", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    getPaymentByOrderIdMock.mockResolvedValue({
      order_id: "order_1",
      user_id: "user-1",
      amount: 5000,
      bead_quantity: 10,
      status: "pending",
    });
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        status: "DONE",
      }),
    });
    settlePaymentAndCreditMock.mockRejectedValue(
      new PaymentDomainErrorMock("PAYMENT_KEY_MISMATCH"),
    );

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({
        paymentKey: "pay_1",
        orderId: "order_1",
        amount: 5000,
      }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({ error: "Payment state conflict" });
  });
});
