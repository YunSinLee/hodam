import { createHmac } from "crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  getOptionalEnvMock,
  getRequiredEnvMock,
  trackUserActivityBestEffortMock,
  getPaymentByOrderIdMock,
  registerWebhookTransmissionMock,
  settlePaymentAndCreditMock,
  createAdminMock,
} = vi.hoisted(() => ({
  getOptionalEnvMock: vi.fn(),
  getRequiredEnvMock: vi.fn(),
  trackUserActivityBestEffortMock: vi.fn(),
  getPaymentByOrderIdMock: vi.fn(),
  registerWebhookTransmissionMock: vi.fn(),
  settlePaymentAndCreditMock: vi.fn(),
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

vi.mock("@/lib/env", () => ({
  getOptionalEnv: getOptionalEnvMock,
  getRequiredEnv: getRequiredEnvMock,
}));

vi.mock("@/lib/server/analytics", () => ({
  trackUserActivityBestEffort: trackUserActivityBestEffortMock,
}));

vi.mock("@/lib/server/payment-service", () => ({
  getPaymentByOrderId: getPaymentByOrderIdMock,
  PaymentDomainError: PaymentDomainErrorMock,
  registerWebhookTransmission: registerWebhookTransmissionMock,
  settlePaymentAndCredit: settlePaymentAndCreditMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: createAdminMock,
}));

async function loadPostHandler() {
  const routeModule = await import("./route");
  return routeModule.POST;
}

describe("POST /api/v1/payments/webhook", () => {
  const fetchMock = vi.fn();

  function mockProvider(
    orderId: string,
    paymentKey: string,
    overrides: Record<string, unknown> = {},
  ) {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        orderId,
        paymentKey,
        totalAmount: 5000,
        status: "DONE",
        ...overrides,
      }),
    });
  }

  function webhookRequest(
    transmissionId: string,
    data: Record<string, unknown> = {},
    eventType = "PAYMENT_STATUS_CHANGED",
  ) {
    return new Request("http://localhost/api/v1/payments/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "tosspayments-webhook-transmission-id": transmissionId,
        "tosspayments-webhook-transmission-time": "2026-09-14T00:00:00.000Z",
        "tosspayments-webhook-transmission-retried-count": "1",
      },
      body: JSON.stringify({
        eventType,
        data: {
          orderId: "order-1",
          paymentKey: "pay-1",
          totalAmount: 5000,
          status: "DONE",
          ...data,
        },
      }),
    }) as never;
  }

  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    getOptionalEnvMock.mockReturnValue(null);
    getRequiredEnvMock.mockReturnValue("toss_test_secret");
    registerWebhookTransmissionMock.mockResolvedValue(true);
    trackUserActivityBestEffortMock.mockResolvedValue(undefined);
    createAdminMock.mockReturnValue({ from: vi.fn(), rpc: vi.fn() });
    getPaymentByOrderIdMock.mockResolvedValue({
      order_id: "order-1",
      user_id: "user-1",
      amount: 5000,
      bead_quantity: 10,
      status: "pending",
    });
    settlePaymentAndCreditMock.mockResolvedValue({
      beadCount: 10,
      alreadyProcessed: false,
    });
    mockProvider("order-1", "pay-1");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 401 when webhook secret does not match", async () => {
    getOptionalEnvMock.mockImplementation((key: string) => {
      if (key === "TOSS_PAYMENTS_WEBHOOK_SECRET") {
        return "expected_secret";
      }
      return null;
    });

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({}),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get("x-request-id")).toMatch(
      /[A-Za-z0-9._:-]{1,128}/,
    );
    expect(body).toEqual({
      error: "Invalid webhook secret",
      code: "WEBHOOK_SECRET_INVALID",
    });
  });

  it("returns 400 when transmission headers are invalid", async () => {
    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers({
        "x-webhook-secret": "ignored",
      }),
      json: vi.fn().mockResolvedValue({}),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: "Invalid webhook transmission headers",
      code: "WEBHOOK_TRANSMISSION_HEADERS_INVALID",
    });
  });

  it("does not let ignored payloads poison a later settlement with the same transmission id", async () => {
    const transmissionHeaders = new Headers({
      "tosspayments-webhook-transmission-id": "transmission-dup-1",
      "tosspayments-webhook-transmission-time": "2026-04-05T00:00:00.000Z",
      "tosspayments-webhook-transmission-retried-count": "0",
    });

    const POST = await loadPostHandler();
    const firstResponse = await POST({
      headers: transmissionHeaders,
      json: vi.fn().mockResolvedValue({ eventType: "PING" }),
    } as never);
    expect(firstResponse.status).toBe(200);

    const secondResponse = await POST({
      headers: transmissionHeaders,
      json: vi.fn().mockResolvedValue({ eventType: "PING" }),
    } as never);
    const secondBody = await secondResponse.json();

    expect(secondResponse.status).toBe(200);
    expect(secondBody).toEqual({
      received: true,
      ignored: true,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(registerWebhookTransmissionMock).not.toHaveBeenCalled();

    const validResponse = await POST(webhookRequest("transmission-dup-1"));
    expect(await validResponse.json()).toMatchObject({ settled: true });
    expect(settlePaymentAndCreditMock).toHaveBeenCalledOnce();
  });

  it("returns duplicate response when transmission is already registered in db", async () => {
    registerWebhookTransmissionMock.mockResolvedValue(false);
    getPaymentByOrderIdMock.mockResolvedValue({
      order_id: "order-db-dup-1",
      user_id: "user-1",
      amount: 5000,
      bead_quantity: 10,
      status: "pending",
    });
    mockProvider("order-db-dup-1", "pay-db-dup-1");

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers({
        "tosspayments-webhook-transmission-id": "transmission-db-dup-1",
        "tosspayments-webhook-transmission-time": "2026-04-05T00:00:00.000Z",
        "tosspayments-webhook-transmission-retried-count": "0",
      }),
      json: vi.fn().mockResolvedValue({
        eventType: "PAYMENT_STATUS_CHANGED",
        data: {
          orderId: "order-db-dup-1",
          paymentKey: "pay-db-dup-1",
          totalAmount: 5000,
          status: "DONE",
        },
      }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      received: true,
      ignored: true,
      reason: "duplicate_event",
    });
    expect(getPaymentByOrderIdMock).toHaveBeenCalledOnce();
    expect(settlePaymentAndCreditMock).toHaveBeenCalledOnce();
    expect(settlePaymentAndCreditMock.mock.invocationCallOrder[0]).toBeLessThan(
      registerWebhookTransmissionMock.mock.invocationCallOrder[0],
    );
  });

  it("returns 400 when webhook payload is invalid json", async () => {
    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers({
        "tosspayments-webhook-transmission-id": "transmission-invalid-json-1",
        "tosspayments-webhook-transmission-time": "2026-04-05T00:00:00.000Z",
        "tosspayments-webhook-transmission-retried-count": "0",
      }),
      json: vi.fn().mockRejectedValue(new Error("invalid payload")),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: "Invalid webhook payload",
      code: "WEBHOOK_PAYLOAD_INVALID",
    });
  });

  it("returns 401 when hmac signature is missing", async () => {
    getOptionalEnvMock.mockImplementation((key: string) => {
      if (key === "TOSS_PAYMENTS_WEBHOOK_HMAC_SECRET") {
        return "hmac_secret";
      }
      return null;
    });

    const POST = await loadPostHandler();
    const rawPayload = JSON.stringify({
      eventType: "PAYMENT_STATUS_CHANGED",
      data: {
        orderId: "order-hmac-missing-1",
        paymentKey: "pay-hmac-missing-1",
        totalAmount: 5000,
        status: "DONE",
      },
    });

    const response = await POST({
      headers: new Headers({
        "tosspayments-webhook-transmission-id": "transmission-hmac-missing-1",
        "tosspayments-webhook-transmission-time": "2026-04-05T00:00:00.000Z",
        "tosspayments-webhook-transmission-retried-count": "0",
      }),
      text: vi.fn().mockResolvedValue(rawPayload),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get("x-request-id")).toMatch(
      /[A-Za-z0-9._:-]{1,128}/,
    );
    expect(body).toEqual({
      error: "Missing webhook signature",
      code: "WEBHOOK_SIGNATURE_INVALID",
    });
  });

  it("accepts webhook when valid hmac signature is provided", async () => {
    mockProvider("order-hmac-ok-1", "pay-hmac-ok-1");
    getOptionalEnvMock.mockImplementation((key: string) => {
      if (key === "TOSS_PAYMENTS_WEBHOOK_HMAC_SECRET") {
        return "hmac_secret";
      }
      if (key === "TOSS_PAYMENTS_WEBHOOK_SIGNATURE_PREFIX") {
        return "sha256=";
      }
      if (key === "TOSS_PAYMENTS_WEBHOOK_SIGNATURE_HEADER") {
        return "x-toss-signature";
      }
      return null;
    });

    getPaymentByOrderIdMock.mockResolvedValue({
      order_id: "order-hmac-ok-1",
      user_id: "user-1",
      amount: 5000,
      bead_quantity: 10,
    });
    settlePaymentAndCreditMock.mockResolvedValue({
      beadCount: 10,
      alreadyProcessed: false,
    });

    const payload = {
      eventType: "PAYMENT_STATUS_CHANGED",
      data: {
        orderId: "order-hmac-ok-1",
        paymentKey: "pay-hmac-ok-1",
        totalAmount: 5000,
        status: "DONE",
      },
    };
    const rawPayload = JSON.stringify(payload);
    const signature = createHmac("sha256", "hmac_secret")
      .update(rawPayload)
      .digest("hex");

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers({
        "tosspayments-webhook-transmission-id": "transmission-hmac-ok-1",
        "tosspayments-webhook-transmission-time": "2026-04-05T00:00:00.000Z",
        "tosspayments-webhook-transmission-retried-count": "0",
        "x-toss-signature": `sha256=${signature}`,
      }),
      text: vi.fn().mockResolvedValue(rawPayload),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      received: true,
      settled: true,
      alreadyProcessed: false,
    });
  });

  it("ignores PAYMENT_STATUS_CHANGED when status is not DONE", async () => {
    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers({
        "tosspayments-webhook-transmission-id": "transmission-status-1",
        "tosspayments-webhook-transmission-time": "2026-04-05T00:00:00.000Z",
        "tosspayments-webhook-transmission-retried-count": "0",
      }),
      json: vi.fn().mockResolvedValue({
        eventType: "PAYMENT_STATUS_CHANGED",
        data: {
          orderId: "order-status-1",
          paymentKey: "pay-status-1",
          totalAmount: 5000,
          status: "IN_PROGRESS",
        },
      }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      received: true,
      ignored: true,
      reason: "status_not_done",
    });
    expect(response.headers.get("x-hodam-payment-flow-id")).toBe(
      "order:order-status-1",
    );
    expect(getPaymentByOrderIdMock).not.toHaveBeenCalled();
  });

  it("settles payment for valid webhook event", async () => {
    getPaymentByOrderIdMock.mockResolvedValue({
      order_id: "order-1",
      user_id: "user-1",
      amount: 5000,
      bead_quantity: 10,
    });
    settlePaymentAndCreditMock.mockResolvedValue({
      beadCount: 10,
      alreadyProcessed: false,
    });

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers({
        "tosspayments-webhook-transmission-id": "transmission-ok-1",
        "tosspayments-webhook-transmission-time": "2026-04-05T00:00:00.000Z",
        "tosspayments-webhook-transmission-retried-count": "0",
      }),
      json: vi.fn().mockResolvedValue({
        eventType: "PAYMENT_STATUS_CHANGED",
        data: {
          orderId: "order-1",
          paymentKey: "pay-1",
          totalAmount: 5000,
          status: "DONE",
        },
      }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(settlePaymentAndCreditMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        order_id: "order-1",
      }),
      "pay-1",
    );
    expect(trackUserActivityBestEffortMock).toHaveBeenCalledWith(
      expect.any(Object),
      "user-1",
      "purchase_webhook_settled",
      expect.objectContaining({
        order_id: "order-1",
      }),
      expect.anything(),
    );
    expect(body).toEqual({
      received: true,
      settled: true,
      alreadyProcessed: false,
    });
    expect(response.headers.get("x-hodam-payment-flow-id")).toBe(
      "order:order-1",
    );
  });

  it("ignores webhook when amount mismatches payment history", async () => {
    mockProvider("order-2", "pay-2");
    getPaymentByOrderIdMock.mockResolvedValue({
      order_id: "order-2",
      user_id: "user-1",
      amount: 10000,
      bead_quantity: 20,
    });

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers({
        "tosspayments-webhook-transmission-id": "transmission-mismatch-1",
        "tosspayments-webhook-transmission-time": "2026-04-05T00:00:00.000Z",
        "tosspayments-webhook-transmission-retried-count": "0",
      }),
      json: vi.fn().mockResolvedValue({
        eventType: "PAYMENT_STATUS_CHANGED",
        data: {
          orderId: "order-2",
          paymentKey: "pay-2",
          totalAmount: 5000,
          status: "DONE",
        },
      }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(settlePaymentAndCreditMock).not.toHaveBeenCalled();
    expect(body).toEqual({
      received: true,
      ignored: true,
      reason: "amount_mismatch",
    });
  });

  it("ignores webhook when order is not found", async () => {
    getPaymentByOrderIdMock.mockResolvedValue(null);

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers({
        "tosspayments-webhook-transmission-id": "transmission-not-found-1",
        "tosspayments-webhook-transmission-time": "2026-04-05T00:00:00.000Z",
        "tosspayments-webhook-transmission-retried-count": "0",
      }),
      json: vi.fn().mockResolvedValue({
        eventType: "PAYMENT_STATUS_CHANGED",
        data: {
          orderId: "order-missing-1",
          paymentKey: "pay-missing-1",
          totalAmount: 5000,
          status: "DONE",
        },
      }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      received: true,
      ignored: true,
      reason: "order_not_found",
    });
    expect(settlePaymentAndCreditMock).not.toHaveBeenCalled();
  });

  it("ignores webhook when payment is already cancelled", async () => {
    getPaymentByOrderIdMock.mockResolvedValue({
      order_id: "order-cancelled-1",
      user_id: "user-1",
      amount: 5000,
      bead_quantity: 10,
      status: "cancelled",
    });

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers({
        "tosspayments-webhook-transmission-id":
          "transmission-cancelled-status-1",
        "tosspayments-webhook-transmission-time": "2026-04-05T00:00:00.000Z",
        "tosspayments-webhook-transmission-retried-count": "0",
      }),
      json: vi.fn().mockResolvedValue({
        eventType: "PAYMENT_STATUS_CHANGED",
        data: {
          orderId: "order-cancelled-1",
          paymentKey: "pay-cancelled-1",
          totalAmount: 5000,
          status: "DONE",
        },
      }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      received: true,
      ignored: true,
      reason: "payment_cancelled",
    });
    expect(settlePaymentAndCreditMock).not.toHaveBeenCalled();
  });

  it("verifies the provider key against payment history when webhook payload key is missing", async () => {
    mockProvider("order-has-key-1", "pay-existing-1");
    getPaymentByOrderIdMock.mockResolvedValue({
      order_id: "order-has-key-1",
      user_id: "user-1",
      amount: 5000,
      bead_quantity: 10,
      payment_key: "pay-existing-1",
      status: "completed",
    });
    settlePaymentAndCreditMock.mockResolvedValue({
      beadCount: 10,
      alreadyProcessed: true,
    });

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers({
        "tosspayments-webhook-transmission-id": "transmission-has-key-1",
        "tosspayments-webhook-transmission-time": "2026-04-05T00:00:00.000Z",
        "tosspayments-webhook-transmission-retried-count": "0",
      }),
      json: vi.fn().mockResolvedValue({
        eventType: "PAYMENT_STATUS_CHANGED",
        data: {
          orderId: "order-has-key-1",
          totalAmount: 5000,
          status: "DONE",
        },
      }),
    } as never);

    expect(response.status).toBe(200);
    expect(settlePaymentAndCreditMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        order_id: "order-has-key-1",
      }),
      "pay-existing-1",
    );
  });

  it("maps payment state conflicts to ignored webhook result", async () => {
    mockProvider("order-conflict-1", "pay-conflict-1");
    getPaymentByOrderIdMock.mockResolvedValue({
      order_id: "order-conflict-1",
      user_id: "user-1",
      amount: 5000,
      bead_quantity: 10,
      status: "pending",
    });
    settlePaymentAndCreditMock.mockRejectedValue(
      new PaymentDomainErrorMock("PAYMENT_KEY_MISMATCH"),
    );

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers({
        "tosspayments-webhook-transmission-id": "transmission-conflict-1",
        "tosspayments-webhook-transmission-time": "2026-04-05T00:00:00.000Z",
        "tosspayments-webhook-transmission-retried-count": "0",
      }),
      json: vi.fn().mockResolvedValue({
        eventType: "PAYMENT_STATUS_CHANGED",
        data: {
          orderId: "order-conflict-1",
          paymentKey: "pay-conflict-1",
          totalAmount: 5000,
          status: "DONE",
        },
      }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      received: true,
      ignored: true,
      reason: "payment_state_conflict",
    });
  });

  it("returns 401 for DEPOSIT_CALLBACK secret mismatch", async () => {
    getPaymentByOrderIdMock.mockResolvedValue({
      order_id: "order-secret-1",
      user_id: "user-1",
      amount: 5000,
      bead_quantity: 10,
    });
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        orderId: "order-secret-1",
        paymentKey: "pay-secret-1",
        totalAmount: 5000,
        status: "DONE",
        secret: "server-secret",
      }),
    });

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers({
        "tosspayments-webhook-transmission-id": "transmission-secret-1",
        "tosspayments-webhook-transmission-time": "2026-04-05T00:00:00.000Z",
        "tosspayments-webhook-transmission-retried-count": "0",
      }),
      json: vi.fn().mockResolvedValue({
        eventType: "DEPOSIT_CALLBACK",
        data: {
          orderId: "order-secret-1",
          secret: "client-secret",
        },
      }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get("x-request-id")).toMatch(
      /[A-Za-z0-9._:-]{1,128}/,
    );
    expect(body).toEqual({
      error: "Invalid webhook secret payload",
      code: "WEBHOOK_SECRET_PAYLOAD_INVALID",
    });
    expect(settlePaymentAndCreditMock).not.toHaveBeenCalled();
  });

  it("ignores webhook when payment key cannot be resolved", async () => {
    getPaymentByOrderIdMock.mockResolvedValue({
      order_id: "order-no-key-1",
      user_id: "user-1",
      amount: 5000,
      bead_quantity: 10,
    });
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        orderId: "order-no-key-1",
        totalAmount: 5000,
        status: "DONE",
      }),
    });

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers({
        "tosspayments-webhook-transmission-id": "transmission-no-key-1",
        "tosspayments-webhook-transmission-time": "2026-04-05T00:00:00.000Z",
        "tosspayments-webhook-transmission-retried-count": "0",
      }),
      json: vi.fn().mockResolvedValue({
        eventType: "DEPOSIT_CALLBACK",
        data: {
          orderId: "order-no-key-1",
        },
      }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      received: true,
      ignored: true,
      reason: "payment_key_missing",
    });
    expect(settlePaymentAndCreditMock).not.toHaveBeenCalled();
  });

  it.each([
    ["provider is unpaid", { status: "IN_PROGRESS" }, {}, "status_not_done"],
    [
      "provider order differs",
      { orderId: "another-order" },
      {},
      "payment_state_conflict",
    ],
    [
      "provider key differs",
      { paymentKey: "another-key" },
      {},
      "payment_state_conflict",
    ],
    ["provider amount differs", { totalAmount: 2500 }, {}, "amount_mismatch"],
    [
      "provider total is missing",
      { totalAmount: undefined, balanceAmount: 5000 },
      {},
      "amount_mismatch",
    ],
    [
      "provider total is not numeric",
      { totalAmount: "5000" },
      {},
      "amount_mismatch",
    ],
    [
      "notification key differs",
      {},
      { paymentKey: "forged-key" },
      "payment_state_conflict",
    ],
    [
      "notification amount differs",
      {},
      { totalAmount: 10000 },
      "amount_mismatch",
    ],
  ] as const)(
    "never settles a forged DONE notification when %s",
    async (name, providerOverrides, bodyOverrides, reason) => {
      mockProvider("order-1", "pay-1", providerOverrides);
      const POST = await loadPostHandler();
      const transmissionId = `adversarial-${name}`;
      const response = await POST(
        webhookRequest(transmissionId, bodyOverrides),
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        received: true,
        ignored: true,
        reason,
      });
      expect(response.headers.get("x-hodam-payment-flow-id")).toBe(
        "order:order-1",
      );
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.tosspayments.com/v1/payments/orders/order-1",
        expect.objectContaining({
          method: "GET",
          headers: {
            Authorization: `Basic ${Buffer.from("toss_test_secret:").toString("base64")}`,
          },
          signal: expect.any(AbortSignal),
        }),
      );
      expect(settlePaymentAndCreditMock).not.toHaveBeenCalled();
      expect(registerWebhookTransmissionMock).not.toHaveBeenCalled();

      // A rejected notification must not consume the provider's delivery id.
      mockProvider("order-1", "pay-1");
      const retry = await POST(webhookRequest(transmissionId));
      expect(await retry.json()).toMatchObject({ settled: true });
    },
  );

  it("rejects a verified provider key that conflicts with the stored payment key", async () => {
    getPaymentByOrderIdMock.mockResolvedValue({
      order_id: "order-1",
      user_id: "user-1",
      amount: 5000,
      bead_quantity: 10,
      status: "pending",
      payment_key: "stored-other-key",
    });
    const POST = await loadPostHandler();
    const response = await POST(webhookRequest("stored-key-conflict"));
    expect(await response.json()).toMatchObject({
      ignored: true,
      reason: "payment_state_conflict",
    });
    expect(settlePaymentAndCreditMock).not.toHaveBeenCalled();
    expect(registerWebhookTransmissionMock).not.toHaveBeenCalled();
  });

  it.each(["http", "transport", "invalid-json"])(
    "allows the same transmission to retry after provider %s failure",
    async failure => {
      if (failure === "transport") {
        fetchMock.mockRejectedValueOnce(new Error("provider timeout"));
      } else if (failure === "invalid-json") {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockRejectedValue(new Error("invalid JSON")),
        });
      } else {
        fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });
      }
      const POST = await loadPostHandler();
      const transmissionId = `provider-retry-${failure}`;
      const failed = await POST(webhookRequest(transmissionId));
      expect(failed.status).toBe(failure === "http" ? 502 : 500);
      expect(settlePaymentAndCreditMock).not.toHaveBeenCalled();
      expect(registerWebhookTransmissionMock).not.toHaveBeenCalled();

      const retry = await POST(webhookRequest(transmissionId));
      expect(await retry.json()).toMatchObject({ settled: true });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(settlePaymentAndCreditMock).toHaveBeenCalledOnce();
      expect(registerWebhookTransmissionMock).toHaveBeenCalledOnce();
    },
  );

  it("allows the same transmission to retry after settlement fails", async () => {
    settlePaymentAndCreditMock.mockRejectedValueOnce(
      new Error("database unavailable"),
    );
    const POST = await loadPostHandler();
    const failed = await POST(webhookRequest("settlement-retry"));
    expect(failed.status).toBe(500);
    expect(registerWebhookTransmissionMock).not.toHaveBeenCalled();

    const retry = await POST(webhookRequest("settlement-retry"));
    expect(await retry.json()).toMatchObject({ settled: true });
    expect(settlePaymentAndCreditMock).toHaveBeenCalledTimes(2);
    expect(registerWebhookTransmissionMock).toHaveBeenCalledOnce();
    expect(settlePaymentAndCreditMock.mock.invocationCallOrder[1]).toBeLessThan(
      registerWebhookTransmissionMock.mock.invocationCallOrder[0],
    );
  });

  it("retries idempotent settlement when transmission registration fails after crediting", async () => {
    registerWebhookTransmissionMock.mockRejectedValueOnce(
      new Error("registry unavailable"),
    );
    settlePaymentAndCreditMock.mockResolvedValueOnce({
      beadCount: 10,
      alreadyProcessed: false,
    });
    settlePaymentAndCreditMock.mockResolvedValue({
      beadCount: 10,
      alreadyProcessed: true,
    });
    const POST = await loadPostHandler();
    const failed = await POST(webhookRequest("registry-retry"));
    expect(failed.status).toBe(500);

    const retry = await POST(webhookRequest("registry-retry"));
    expect(await retry.json()).toEqual({
      received: true,
      settled: true,
      alreadyProcessed: true,
    });
    expect(settlePaymentAndCreditMock).toHaveBeenCalledTimes(2);
    expect(registerWebhookTransmissionMock).toHaveBeenCalledTimes(2);
  });

  it("caches successful settlement only for the same transmission and order", async () => {
    const POST = await loadPostHandler();
    const first = await POST(webhookRequest("scoped-cache"));
    expect(await first.json()).toMatchObject({ settled: true });
    const duplicate = await POST(webhookRequest("scoped-cache"));
    expect(await duplicate.json()).toEqual({
      received: true,
      ignored: true,
      reason: "duplicate_event",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(settlePaymentAndCreditMock).toHaveBeenCalledOnce();
    expect(registerWebhookTransmissionMock).toHaveBeenCalledOnce();

    getPaymentByOrderIdMock.mockResolvedValue({
      order_id: "order-other",
      user_id: "user-1",
      amount: 5000,
      bead_quantity: 10,
      status: "pending",
    });
    mockProvider("order-other", "pay-other");
    const otherOrder = await POST(
      webhookRequest("scoped-cache", {
        orderId: "order-other",
        paymentKey: "pay-other",
      }),
    );
    expect(await otherOrder.json()).toMatchObject({ settled: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(settlePaymentAndCreditMock).toHaveBeenCalledTimes(2);
  });

  it("does not cache an ignored non-final payment notification", async () => {
    const POST = await loadPostHandler();
    const ignored = await POST(
      webhookRequest("non-final-retry", { status: "IN_PROGRESS" }),
    );
    expect(await ignored.json()).toEqual({
      received: true,
      ignored: true,
      reason: "status_not_done",
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getPaymentByOrderIdMock).not.toHaveBeenCalled();
    expect(registerWebhookTransmissionMock).not.toHaveBeenCalled();

    const final = await POST(webhookRequest("non-final-retry"));
    expect(await final.json()).toMatchObject({ settled: true });
  });

  it("uses configured toss api base url for order lookup", async () => {
    getOptionalEnvMock.mockImplementation((key: string) => {
      if (key === "TOSS_PAYMENTS_SECRET_KEY") {
        return "toss_test_secret";
      }
      if (key === "TOSS_PAYMENTS_API_BASE_URL") {
        return "https://sandbox.tosspayments.com";
      }
      return null;
    });
    getPaymentByOrderIdMock.mockResolvedValue({
      order_id: "order-base-url-1",
      user_id: "user-1",
      amount: 5000,
      bead_quantity: 10,
    });
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        orderId: "order-base-url-1",
        paymentKey: "pay-base-url-1",
        totalAmount: 5000,
        status: "DONE",
      }),
    });
    settlePaymentAndCreditMock.mockResolvedValue({
      beadCount: 10,
      alreadyProcessed: false,
    });

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers({
        "tosspayments-webhook-transmission-id": "transmission-base-url-1",
        "tosspayments-webhook-transmission-time": "2026-04-05T00:00:00.000Z",
        "tosspayments-webhook-transmission-retried-count": "0",
      }),
      json: vi.fn().mockResolvedValue({
        eventType: "DEPOSIT_CALLBACK",
        data: {
          orderId: "order-base-url-1",
        },
      }),
    } as never);

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://sandbox.tosspayments.com/v1/payments/orders/order-base-url-1",
      expect.objectContaining({
        method: "GET",
      }),
    );
  });
});
