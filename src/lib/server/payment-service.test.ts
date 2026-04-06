import { describe, expect, it, vi } from "vitest";

import {
  createOrderId,
  createPendingPayment,
  findRecentPendingPayment,
  getPaymentByOrderId,
  listPaymentsByUser,
  PaymentDomainError,
  markPaymentFailed,
  registerWebhookTransmission,
  settlePaymentAndCredit,
} from "@/lib/server/payment-service";

function createInsertClient(response: unknown) {
  const single = vi.fn().mockResolvedValue(response);
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });
  const from = vi.fn().mockReturnValue({ insert });
  return {
    client: { from } as never,
    from,
    insert,
    select,
    single,
  };
}

describe("payment-service", () => {
  it("creates order id with default prefix", () => {
    const orderId = createOrderId();

    expect(orderId.startsWith("HODAM_")).toBe(true);
    expect(orderId.split("_").length).toBe(3);
  });

  it("creates order id with custom prefix", () => {
    const orderId = createOrderId("TEST");
    expect(orderId.startsWith("TEST_")).toBe(true);
  });

  it("creates pending payment row", async () => {
    const row = {
      id: "1",
      user_id: "user-1",
      order_id: "order-1",
      amount: 5000,
      bead_quantity: 10,
      status: "pending",
      created_at: "2026-04-05T00:00:00.000Z",
    };
    const { client, insert } = createInsertClient({ data: row, error: null });

    const result = await createPendingPayment(client, {
      userId: "user-1",
      orderId: "order-1",
      amount: 5000,
      beadQuantity: 10,
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        order_id: "order-1",
        amount: 5000,
      }),
    );
    expect(result.order_id).toBe("order-1");
  });

  it("throws when create pending payment fails", async () => {
    const { client } = createInsertClient({
      data: null,
      error: new Error("insert failed"),
    });

    await expect(
      createPendingPayment(client, {
        userId: "user-1",
        orderId: "order-1",
        amount: 5000,
        beadQuantity: 10,
      }),
    ).rejects.toThrow("insert failed");
  });

  it("loads payment by order id and returns null for not found", async () => {
    const single = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          id: "1",
          user_id: "user-1",
          order_id: "order-1",
          amount: 5000,
          bead_quantity: 10,
          status: "pending",
          created_at: "2026-04-05T00:00:00.000Z",
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { code: "PGRST116" },
      });
    const select = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({ single }),
    });
    const from = vi.fn().mockReturnValue({ select });
    const client = { from } as never;

    const found = await getPaymentByOrderId(client, "order-1");
    const missing = await getPaymentByOrderId(client, "order-missing");

    expect(found?.order_id).toBe("order-1");
    expect(missing).toBeNull();
  });

  it("throws for unexpected lookup errors", async () => {
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "400", message: "boom" },
    });
    const select = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({ single }),
    });
    const from = vi.fn().mockReturnValue({ select });
    const client = { from } as never;

    await expect(getPaymentByOrderId(client, "order-1")).rejects.toEqual(
      expect.objectContaining({ message: "boom" }),
    );
  });

  it("lists payments by user ordered by created_at desc", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [{ order_id: "order-1" }],
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const client = { from } as never;

    const result = await listPaymentsByUser(client, "user-1");

    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(result).toHaveLength(1);
  });

  it("finds recent pending payment for idempotent prepare", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        order_id: "order-pending-1",
        status: "pending",
      },
      error: null,
    });
    const limit = vi.fn().mockReturnValue({ maybeSingle });
    const order = vi.fn().mockReturnValue({ limit });
    const gte = vi.fn().mockReturnValue({ order });
    const eqStatus = vi.fn().mockReturnValue({ gte });
    const eqBeadQuantity = vi.fn().mockReturnValue({ eq: eqStatus });
    const eqAmount = vi.fn().mockReturnValue({ eq: eqBeadQuantity });
    const eqUser = vi.fn().mockReturnValue({ eq: eqAmount });
    const select = vi.fn().mockReturnValue({ eq: eqUser });
    const from = vi.fn().mockReturnValue({ select });
    const client = { from } as never;

    const result = await findRecentPendingPayment(client, {
      userId: "user-1",
      amount: 5000,
      beadQuantity: 10,
      lookbackMinutes: 5,
    });

    expect(eqUser).toHaveBeenCalledWith("user_id", "user-1");
    expect(eqAmount).toHaveBeenCalledWith("amount", 5000);
    expect(eqBeadQuantity).toHaveBeenCalledWith("bead_quantity", 10);
    expect(eqStatus).toHaveBeenCalledWith("status", "pending");
    expect(result?.order_id).toBe("order-pending-1");
  });

  it("registers webhook transmission through rpc", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: true,
      error: null,
    });
    const client = { rpc } as never;

    const result = await registerWebhookTransmission(client, {
      transmissionId: "tx-1",
      orderId: "order-1",
      eventType: "PAYMENT_STATUS_CHANGED",
      transmissionTime: "2026-04-06T00:00:00.000Z",
      retriedCount: 1,
    });

    expect(result).toBe(true);
    expect(rpc).toHaveBeenCalledWith("register_webhook_transmission", {
      p_transmission_id: "tx-1",
      p_order_id: "order-1",
      p_event_type: "PAYMENT_STATUS_CHANGED",
      p_transmission_time: "2026-04-06T00:00:00.000Z",
      p_retried_count: 1,
    });
  });

  it("finalizes payment through rpc and parses response", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ bead_count: 10, already_processed: false }],
      error: null,
    });
    const client = { rpc } as never;

    const result = await settlePaymentAndCredit(
      client,
      {
        id: "1",
        user_id: "user-1",
        order_id: "order-1",
        amount: 5000,
        bead_quantity: 10,
        status: "pending",
        created_at: "2026-04-05T00:00:00.000Z",
      },
      "pay-1",
    );

    expect(rpc).toHaveBeenCalledWith("finalize_payment", {
      p_order_id: "order-1",
      p_payment_key: "pay-1",
      p_user_id: "user-1",
    });
    expect(result).toEqual({ beadCount: 10, alreadyProcessed: false });
  });

  it("throws when rpc returns empty data", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const client = { rpc } as never;

    await expect(
      settlePaymentAndCredit(
        client,
        {
          id: "1",
          user_id: "user-1",
          order_id: "order-1",
          amount: 5000,
          bead_quantity: 10,
          status: "pending",
          created_at: "2026-04-05T00:00:00.000Z",
        },
        "pay-1",
      ),
    ).rejects.toThrow("Failed to finalize payment");
  });

  it("maps known rpc payment errors to PaymentDomainError", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "PAYMENT_KEY_MISMATCH" },
    });
    const client = { rpc } as never;

    await expect(
      settlePaymentAndCredit(
        client,
        {
          id: "1",
          user_id: "user-1",
          order_id: "order-1",
          amount: 5000,
          bead_quantity: 10,
          status: "pending",
          created_at: "2026-04-05T00:00:00.000Z",
        },
        "pay-1",
      ),
    ).rejects.toEqual(expect.any(PaymentDomainError));
  });

  it("marks pending payment as failed", async () => {
    const eqStatus = vi.fn().mockResolvedValue({ data: null, error: null });
    const eqOrder = vi.fn().mockReturnValue({ eq: eqStatus });
    const update = vi.fn().mockReturnValue({ eq: eqOrder });
    const from = vi.fn().mockReturnValue({ update });
    const client = { from } as never;

    await markPaymentFailed(client, "order-1");

    expect(update).toHaveBeenCalledWith({ status: "failed" });
    expect(eqOrder).toHaveBeenCalledWith("order_id", "order-1");
    expect(eqStatus).toHaveBeenCalledWith("status", "pending");
  });
});
