import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authenticateRequestMock,
  listPaymentsByUserMock,
  createAdminMock,
  checkRateLimitMock,
} = vi.hoisted(() => ({
  authenticateRequestMock: vi.fn(),
  listPaymentsByUserMock: vi.fn(),
  createAdminMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
}));

vi.mock("@/lib/auth/request-auth", () => ({
  authenticateRequest: authenticateRequestMock,
}));

vi.mock("@/lib/server/payment-service", () => ({
  listPaymentsByUser: listPaymentsByUserMock,
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

describe("GET /api/v1/payments/history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkRateLimitMock.mockReturnValue(true);
  });

  it("returns 401 when unauthorized", async () => {
    authenticateRequestMock.mockResolvedValue(null);
    const GET = await loadGetHandler();

    const response = await GET({ headers: new Headers() } as never);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get("x-request-id")).toMatch(
      /[A-Za-z0-9._:-]{1,128}/,
    );
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("returns payment history for authenticated user", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    createAdminMock.mockReturnValue({ from: vi.fn() });
    listPaymentsByUserMock.mockResolvedValue([
      {
        id: "payment-1",
        user_id: "user-1",
        order_id: "order-1",
        amount: 5000,
        bead_quantity: 10,
        status: "completed",
      },
    ]);

    const GET = await loadGetHandler();
    const response = await GET({ headers: new Headers() } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(listPaymentsByUserMock).toHaveBeenCalledWith(
      expect.any(Object),
      "user-1",
    );
    expect(body.payments).toHaveLength(1);
  });

  it("returns 429 when rate limit is exceeded", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    checkRateLimitMock.mockReturnValue(false);

    const GET = await loadGetHandler();
    const response = await GET({ headers: new Headers() } as never);
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toEqual({ error: "Too many payment history requests" });
  });

  it("returns 500 when repository call fails", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    createAdminMock.mockReturnValue({ from: vi.fn() });
    listPaymentsByUserMock.mockRejectedValue(new Error("db failure"));

    const GET = await loadGetHandler();
    const response = await GET({ headers: new Headers() } as never);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "Failed to fetch payment history" });
  });
});
