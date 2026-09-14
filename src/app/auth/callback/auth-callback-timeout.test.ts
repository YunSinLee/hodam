import { describe, expect, it } from "vitest";

import {
  AUTH_MANUAL_RECOVERY_HINT_MS,
  AUTH_NO_PAYLOAD_SESSION_TIMEOUT_MS,
  AUTH_STEP_TIMEOUT_MS,
  AUTH_TOTAL_TIMEOUT_MS,
  wait,
  withTimeout,
} from "@/app/auth/callback/auth-callback-timeout";

describe("auth-callback-timeout", () => {
  it("exposes expected timeout constants", () => {
    expect(AUTH_STEP_TIMEOUT_MS).toBe(15000);
    expect(AUTH_TOTAL_TIMEOUT_MS).toBe(22000);
    expect(AUTH_NO_PAYLOAD_SESSION_TIMEOUT_MS).toBe(5000);
    expect(AUTH_MANUAL_RECOVERY_HINT_MS).toBe(8000);
  });

  it("resolves value before timeout", async () => {
    await expect(
      withTimeout(Promise.resolve("ok"), 30, "sample"),
    ).resolves.toBe("ok");
  });

  it("rejects with timeout error when promise does not resolve in time", async () => {
    const never = new Promise<void>(() => {});
    await expect(withTimeout(never, 5, "never")).rejects.toThrow(
      "never timeout (5ms)",
    );
  });

  it("wait resolves after requested delay", async () => {
    const start = Date.now();
    await wait(5);
    expect(Date.now() - start).toBeGreaterThanOrEqual(4);
  });
});
