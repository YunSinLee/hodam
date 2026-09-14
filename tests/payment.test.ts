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
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.auth.mockResolvedValue({ user: { id: "owner" } });
  mocks.configured.mockReturnValue(true);
  mocks.eq.mockReturnValue({ eq: mocks.eq, single: mocks.single });
  mocks.single.mockResolvedValue({ data: order, error: null });
  mocks.insert.mockResolvedValue({ error: null });
  mocks.rpc.mockResolvedValue({ error: null });
});
describe("server payment boundary", () => {
  it("routes legacy confirmation through the hardened v1 handler", async () => {
    const legacy = await import("../src/app/api/routes/payment/confirm/route");
    const v1 = await import("../src/app/api/v1/payments/confirm/route");
    expect(legacy.POST).toBe(v1.POST);
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
