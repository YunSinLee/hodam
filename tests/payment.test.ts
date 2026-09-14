import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  configured: vi.fn(),
  single: vi.fn(),
  insert: vi.fn(),
  rpc: vi.fn(),
  eq: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock("@/app/api/server-auth", () => ({ requireServerUser: mocks.auth }));
vi.mock("@/app/api/server-payment", () => ({
  paymentConfigured: mocks.configured,
  paymentAdmin: () => ({
    from: () => ({ select: () => ({ eq: mocks.eq }), insert: mocks.insert }),
    rpc: mocks.rpc,
  }),
}));
import { POST as confirmPayment } from "../src/app/api/routes/payment/confirm/route";
import { POST as createPayment } from "../src/app/api/routes/payment/create/route";
import { beadPackages } from "../src/app/utils/bead-packages";
const pkg = beadPackages[0];
const body = {
  orderId: "HODAM_valid-order-1234",
  paymentKey: "valid-payment-key-1234",
  amount: pkg.price,
};
const order = {
  order_id: body.orderId,
  payment_key: null,
  user_id: "owner",
  amount: pkg.price,
  bead_quantity: pkg.quantity,
  status: "pending",
};
const request = (value: unknown) =>
  new NextRequest("http://localhost/api/routes/payment/confirm", {
    method: "POST",
    headers: {
      Authorization: "Bearer valid",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(value),
  });
const approved = { status: "DONE", ...body, totalAmount: pkg.price };
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.auth.mockResolvedValue({ user: { id: "owner" } });
  mocks.configured.mockReturnValue(true);
  mocks.eq.mockReturnValue({ eq: mocks.eq, single: mocks.single });
  mocks.single.mockResolvedValue({ data: order, error: null });
  mocks.insert.mockResolvedValue({ error: null });
  mocks.rpc.mockResolvedValue({ error: null });
  mocks.fetch.mockResolvedValue(Response.json(approved));
});
describe("server payment boundary", () => {
  it("rejects unauthenticated confirmation before touching provider or balance", async () => {
    mocks.auth.mockRejectedValue(new Error("unauthorized"));
    expect((await confirmPayment(request(body))).status).toBe(401);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects an amount altered in the redirect URL", async () => {
    expect((await confirmPayment(request({ ...body, amount: 1 }))).status).toBe(
      400,
    );
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("does not reveal or confirm another user's order", async () => {
    mocks.single.mockResolvedValue({
      data: null,
      error: new Error("not found"),
    });
    expect((await confirmPayment(request(body))).status).toBe(404);
    expect(mocks.eq).toHaveBeenCalledWith("user_id", "owner");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("returns a previously credited order without charging or crediting again", async () => {
    mocks.single.mockResolvedValue({
      data: {
        ...order,
        status: "completed",
        payment_key: body.paymentKey,
        credited_at: "2026-09-14",
        credited_user_id: "owner",
      },
    });
    expect((await confirmPayment(request(body))).status).toBe(200);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("requires a credited ledger entry before claiming old orders succeeded", async () => {
    mocks.single.mockResolvedValue({ data: { ...order, status: "completed" } });
    expect((await confirmPayment(request(body))).status).toBe(409);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("verifies provider proof then uses the atomic finalization function", async () => {
    expect((await confirmPayment(request(body))).status).toBe(200);
    expect(mocks.fetch.mock.calls[0][1].headers["Idempotency-Key"]).toBe(
      `confirm_${body.orderId}`,
    );
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("finalize_payment", {
      p_order_id: body.orderId,
      p_payment_key: body.paymentKey,
      p_user_id: "owner",
    });
  });
  it.each(["status", "orderId", "paymentKey", "totalAmount"])(
    "does not credit a mismatched provider %s",
    async field => {
      mocks.fetch.mockResolvedValue(
        Response.json({ ...approved, [field]: "mismatch" }),
      );
      expect((await confirmPayment(request(body))).status).toBe(409);
      expect(mocks.rpc).not.toHaveBeenCalled();
    },
  );
  it("recovers an already-approved payment by querying its actual state", async () => {
    mocks.fetch
      .mockResolvedValueOnce(
        Response.json({ code: "ALREADY_PROCESSED_PAYMENT" }, { status: 400 }),
      )
      .mockResolvedValueOnce(Response.json(approved));
    expect((await confirmPayment(request(body))).status).toBe(200);
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("leaves timeouts retryable and never claims a credit succeeded", async () => {
    mocks.fetch.mockRejectedValue(new Error("timeout"));
    expect((await confirmPayment(request(body))).status).toBe(503);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("reports database finalization failure as retryable", async () => {
    mocks.rpc.mockResolvedValue({ error: new Error("offline") });
    expect((await confirmPayment(request(body))).status).toBe(503);
  });
  it("creates a server-priced order and ignores client owner and amount", async () => {
    expect(
      (
        await createPayment(
          request({
            quantity: pkg.quantity,
            amount: 1,
            userId: "someone-else",
          }),
        )
      ).status,
    ).toBe(200);
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "owner",
        amount: pkg.price,
        bead_quantity: pkg.quantity,
        status: "pending",
      }),
    );
  });
  it("does not create a payable order when server configuration is missing", async () => {
    mocks.configured.mockReturnValue(false);
    expect(
      (await createPayment(request({ quantity: pkg.quantity }))).status,
    ).toBe(503);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
