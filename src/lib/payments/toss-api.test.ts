import { beforeEach, describe, expect, it, vi } from "vitest";

const { getOptionalEnvMock } = vi.hoisted(() => ({
  getOptionalEnvMock: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  getOptionalEnv: getOptionalEnvMock,
}));

describe("toss-api helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOptionalEnvMock.mockReturnValue(undefined);
  });

  it("builds Toss v1 url with default production base", async () => {
    const { buildTossApiUrl } = await import("./toss-api");

    expect(buildTossApiUrl("/payments/confirm")).toBe(
      "https://api.tosspayments.com/v1/payments/confirm",
    );
  });

  it("uses configured base url and preserves /v1 without duplication", async () => {
    getOptionalEnvMock.mockReturnValue("https://sandbox.tosspayments.com/v1/");

    const { buildTossApiUrl } = await import("./toss-api");

    expect(buildTossApiUrl("/payments/orders/order_1")).toBe(
      "https://sandbox.tosspayments.com/v1/payments/orders/order_1",
    );
  });

  it("throws when configured base url is invalid", async () => {
    getOptionalEnvMock.mockReturnValue("not-a-url");

    const { buildTossApiUrl } = await import("./toss-api");

    expect(() => buildTossApiUrl("/payments/confirm")).toThrow(
      "Invalid environment variable: TOSS_PAYMENTS_API_BASE_URL",
    );
  });

  it("creates basic authorization header", async () => {
    const { createTossBasicAuthorization } = await import("./toss-api");

    expect(createTossBasicAuthorization("test_secret")).toBe(
      `Basic ${Buffer.from("test_secret:").toString("base64")}`,
    );
  });
});
