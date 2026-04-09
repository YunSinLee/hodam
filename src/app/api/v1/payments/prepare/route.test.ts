import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authenticateRequestMock,
  findBeadPackageByIdMock,
  trackUserActivityBestEffortMock,
  createOrderIdMock,
  createPendingPaymentMock,
  findRecentPendingPaymentMock,
  checkRateLimitMock,
  createAdminMock,
} = vi.hoisted(() => ({
  authenticateRequestMock: vi.fn(),
  findBeadPackageByIdMock: vi.fn(),
  trackUserActivityBestEffortMock: vi.fn(),
  createOrderIdMock: vi.fn(),
  createPendingPaymentMock: vi.fn(),
  findRecentPendingPaymentMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  createAdminMock: vi.fn(),
}));

vi.mock("@/lib/auth/request-auth", () => ({
  authenticateRequest: authenticateRequestMock,
}));

vi.mock("@/lib/payments/packages", () => ({
  findBeadPackageById: findBeadPackageByIdMock,
}));

vi.mock("@/lib/server/analytics", () => ({
  trackUserActivityBestEffort: trackUserActivityBestEffortMock,
}));

vi.mock("@/lib/server/payment-service", () => ({
  createOrderId: createOrderIdMock,
  createPendingPayment: createPendingPaymentMock,
  findRecentPendingPayment: findRecentPendingPaymentMock,
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

describe("POST /api/v1/payments/prepare", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkRateLimitMock.mockReturnValue(true);
    createOrderIdMock.mockReturnValue("HODAM_test_order_1");
    trackUserActivityBestEffortMock.mockResolvedValue(undefined);
    createPendingPaymentMock.mockResolvedValue({
      id: "payment-row-1",
    });
    findRecentPendingPaymentMock.mockResolvedValue(null);
    createAdminMock.mockReturnValue({ from: vi.fn() });
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
    expect(body).toEqual({
      error: "Unauthorized",
      code: "AUTH_UNAUTHORIZED",
    });
  });

  it("returns 401 when authenticateRequest throws", async () => {
    authenticateRequestMock.mockRejectedValue(new Error("auth transport down"));
    const POST = await loadPostHandler();

    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({ packageId: "bead_10" }),
    } as never);
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
    const POST = await loadPostHandler();

    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({ packageId: "bead_10" }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toEqual({
      error: "Too many payment preparation requests",
      code: "PAYMENTS_PREPARE_RATE_LIMITED",
    });
  });

  it("returns 400 when body is invalid json", async () => {
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
    expect(body).toEqual({
      error: "Invalid JSON body",
      code: "REQUEST_JSON_INVALID",
    });
  });

  it("returns 400 when packageId is invalid", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    findBeadPackageByIdMock.mockReturnValue(null);
    const POST = await loadPostHandler();

    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({ packageId: "unknown_package" }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: "Invalid packageId",
      code: "PAYMENTS_PACKAGE_ID_INVALID",
    });
  });

  it("returns 400 when packageId type is invalid", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    const POST = await loadPostHandler();

    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({ packageId: 10 }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: "packageId must be a string",
      code: "PAYMENTS_PACKAGE_ID_TYPE_INVALID",
    });
  });

  it("prepares payment and tracks analytics", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    findBeadPackageByIdMock.mockReturnValue({
      id: "bead_10",
      quantity: 10,
      price: 5000,
      originalPrice: 6000,
      discount: 17,
      popular: true,
      description: "인기 패키지",
    });
    const POST = await loadPostHandler();

    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({ packageId: "bead_10" }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(createPendingPaymentMock).toHaveBeenCalledWith(expect.any(Object), {
      userId: "user-1",
      orderId: "HODAM_test_order_1",
      paymentFlowId: "order:HODAM_test_order_1",
      amount: 5000,
      beadQuantity: 10,
    });
    expect(trackUserActivityBestEffortMock).toHaveBeenCalledWith(
      expect.any(Object),
      "user-1",
      "purchase_prepare",
      expect.objectContaining({
        order_id: "HODAM_test_order_1",
        package_id: "bead_10",
      }),
      expect.anything(),
    );
    expect(body).toEqual(
      expect.objectContaining({
        orderId: "HODAM_test_order_1",
        amount: 5000,
        orderName: "곶감 10개",
        paymentFlowId: "order:HODAM_test_order_1",
      }),
    );
    expect(response.headers.get("x-hodam-payment-flow-id")).toBe(
      "order:HODAM_test_order_1",
    );
  });

  it("returns 500 when payment preparation fails", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    findBeadPackageByIdMock.mockReturnValue({
      id: "bead_10",
      quantity: 10,
      price: 5000,
      originalPrice: 6000,
      discount: 17,
      popular: true,
      description: "인기 패키지",
    });
    createPendingPaymentMock.mockRejectedValue(new Error("insert failed"));

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({ packageId: "bead_10" }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: "Failed to prepare payment",
      code: "PAYMENTS_PREPARE_FAILED",
    });
  });

  it("reuses a recent pending payment instead of creating a new one", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    findBeadPackageByIdMock.mockReturnValue({
      id: "bead_10",
      quantity: 10,
      price: 5000,
      originalPrice: 6000,
      discount: 17,
      popular: true,
      description: "인기 패키지",
    });
    findRecentPendingPaymentMock.mockResolvedValue({
      id: "payment-row-existing",
      order_id: "HODAM_existing_order_1",
      user_id: "user-1",
      amount: 5000,
      bead_quantity: 10,
      status: "pending",
      created_at: "2026-04-06T00:00:00.000Z",
    });

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({ packageId: "bead_10" }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(createPendingPaymentMock).not.toHaveBeenCalled();
    expect(createOrderIdMock).not.toHaveBeenCalled();
    expect(body.orderId).toBe("HODAM_existing_order_1");
  });
});
