import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DailyQuotaExceededError,
  consumeDailyAiQuota,
  consumeDailyTtsQuota,
} from "@/lib/server/quota";

type AdminClient = Parameters<typeof consumeDailyAiQuota>[0];

function createAdminMock(
  rpcImpl?:
    | { (...args: unknown[]): Promise<unknown> }
    | ReturnType<typeof vi.fn>,
): AdminClient {
  return {
    rpc: rpcImpl || vi.fn(),
  } as unknown as AdminClient;
}

describe("quota", () => {
  const originalAiLimit = process.env.HODAM_DAILY_AI_COST_LIMIT;
  const originalTtsLimit = process.env.HODAM_DAILY_TTS_CHAR_LIMIT;

  afterEach(() => {
    process.env.HODAM_DAILY_AI_COST_LIMIT = originalAiLimit;
    process.env.HODAM_DAILY_TTS_CHAR_LIMIT = originalTtsLimit;
    vi.restoreAllMocks();
  });

  it("uses default AI limit and forwards RPC payload", async () => {
    delete process.env.HODAM_DAILY_AI_COST_LIMIT;

    const rpc = vi.fn().mockResolvedValue({
      data: { allowed: true, used: 10, remaining: 110 },
      error: null,
    });
    const admin = createAdminMock(rpc);

    const result = await consumeDailyAiQuota(admin, "user-1", 10, {
      route: "start",
    });

    expect(result).toEqual({ allowed: true, used: 10, remaining: 110 });
    expect(rpc).toHaveBeenCalledWith(
      "consume_daily_quota",
      expect.objectContaining({
        p_user_id: "user-1",
        p_action: "ai_cost",
        p_cost: 10,
        p_daily_limit: 120,
      }),
    );
  });

  it("uses env override for AI limit when set", async () => {
    process.env.HODAM_DAILY_AI_COST_LIMIT = "50";
    const rpc = vi.fn().mockResolvedValue({
      data: { allowed: true, used: 5, remaining: 45 },
      error: null,
    });
    const admin = createAdminMock(rpc);

    await consumeDailyAiQuota(admin, "user-1", 5);

    expect(rpc).toHaveBeenCalledWith(
      "consume_daily_quota",
      expect.objectContaining({
        p_action: "ai_cost",
        p_daily_limit: 50,
      }),
    );
  });

  it("short-circuits when AI cost is zero", async () => {
    delete process.env.HODAM_DAILY_AI_COST_LIMIT;
    const rpc = vi.fn();
    const admin = createAdminMock(rpc);

    const result = await consumeDailyAiQuota(admin, "user-1", 0);

    expect(result).toEqual({ allowed: true, used: 0, remaining: 120 });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("throws DailyQuotaExceededError when AI quota is denied", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { allowed: false, used: 120, remaining: 0 },
      error: null,
    });
    const admin = createAdminMock(rpc);

    await expect(consumeDailyAiQuota(admin, "user-1", 1)).rejects.toMatchObject(
      {
        name: "DailyQuotaExceededError",
        code: "DAILY_AI_COST_LIMIT_EXCEEDED",
      } satisfies Partial<DailyQuotaExceededError>,
    );
  });

  it("uses default TTS limit and action", async () => {
    delete process.env.HODAM_DAILY_TTS_CHAR_LIMIT;
    const rpc = vi.fn().mockResolvedValue({
      data: { allowed: true, used: 100, remaining: 29900 },
      error: null,
    });
    const admin = createAdminMock(rpc);

    const result = await consumeDailyTtsQuota(admin, "user-1", 100, {
      route: "tts",
    });

    expect(result).toEqual({ allowed: true, used: 100, remaining: 29900 });
    expect(rpc).toHaveBeenCalledWith(
      "consume_daily_quota",
      expect.objectContaining({
        p_action: "tts_chars",
        p_daily_limit: 30000,
      }),
    );
  });
});
