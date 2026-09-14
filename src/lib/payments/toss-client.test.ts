import { beforeEach, describe, expect, it, vi } from "vitest";

const { getOptionalEnvMock } = vi.hoisted(() => ({
  getOptionalEnvMock: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  getOptionalEnv: getOptionalEnvMock,
}));

describe("resolveTossClientKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when env is missing", async () => {
    getOptionalEnvMock.mockReturnValue(undefined);
    const { resolveTossClientKey } = await import("./toss-client");

    expect(resolveTossClientKey()).toBeNull();
  });

  it("returns client key when env exists", async () => {
    getOptionalEnvMock.mockReturnValue("test_ck_example");
    const { resolveTossClientKey } = await import("./toss-client");

    expect(resolveTossClientKey()).toBe("test_ck_example");
  });
});
