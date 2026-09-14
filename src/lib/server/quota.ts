import { SupabaseClient } from "@supabase/supabase-js";

import { getOptionalEnv } from "@/lib/env";

const DEFAULT_DAILY_AI_COST_LIMIT = 120;
const DEFAULT_DAILY_TTS_CHAR_LIMIT = 30000;

type QuotaAction = "ai_cost" | "tts_chars";

interface ConsumeDailyQuotaResult {
  allowed: boolean;
  used: number;
  remaining: number;
}

export class DailyQuotaExceededError extends Error {
  readonly code:
    | "DAILY_AI_COST_LIMIT_EXCEEDED"
    | "DAILY_TTS_CHAR_LIMIT_EXCEEDED";

  constructor(
    code: "DAILY_AI_COST_LIMIT_EXCEEDED" | "DAILY_TTS_CHAR_LIMIT_EXCEEDED",
  ) {
    super(code);
    this.name = "DailyQuotaExceededError";
    this.code = code;
  }
}

function parsePositiveInt(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function getDailyAiCostLimit(): number {
  return (
    parsePositiveInt(getOptionalEnv("HODAM_DAILY_AI_COST_LIMIT")) ??
    DEFAULT_DAILY_AI_COST_LIMIT
  );
}

function getDailyTtsCharLimit(): number {
  return (
    parsePositiveInt(getOptionalEnv("HODAM_DAILY_TTS_CHAR_LIMIT")) ??
    DEFAULT_DAILY_TTS_CHAR_LIMIT
  );
}

async function consumeDailyQuota(
  admin: SupabaseClient,
  params: {
    userId: string;
    action: QuotaAction;
    cost: number;
    dailyLimit: number;
    meta?: Record<string, unknown>;
  },
): Promise<ConsumeDailyQuotaResult> {
  if (params.cost <= 0) {
    return {
      allowed: true,
      used: 0,
      remaining: params.dailyLimit,
    };
  }

  if (params.dailyLimit <= 0) {
    return {
      allowed: true,
      used: 0,
      remaining: Number.MAX_SAFE_INTEGER,
    };
  }

  const { data, error } = await admin.rpc("consume_daily_quota", {
    p_user_id: params.userId,
    p_action: params.action,
    p_cost: params.cost,
    p_daily_limit: params.dailyLimit,
    p_meta: params.meta ?? {},
  });

  if (error) {
    throw error;
  }

  const row = Array.isArray(data)
    ? (data[0] as Partial<ConsumeDailyQuotaResult> | undefined)
    : (data as Partial<ConsumeDailyQuotaResult> | null);

  if (!row || typeof row.allowed !== "boolean") {
    throw new Error("Invalid quota RPC response");
  }

  return {
    allowed: row.allowed,
    used: Number(row.used || 0),
    remaining: Number(row.remaining || 0),
  };
}

export async function consumeDailyAiQuota(
  admin: SupabaseClient,
  userId: string,
  cost: number,
  meta?: Record<string, unknown>,
) {
  const result = await consumeDailyQuota(admin, {
    userId,
    action: "ai_cost",
    cost,
    dailyLimit: getDailyAiCostLimit(),
    meta,
  });

  if (!result.allowed) {
    throw new DailyQuotaExceededError("DAILY_AI_COST_LIMIT_EXCEEDED");
  }

  return result;
}

export async function consumeDailyTtsQuota(
  admin: SupabaseClient,
  userId: string,
  textLength: number,
  meta?: Record<string, unknown>,
) {
  const result = await consumeDailyQuota(admin, {
    userId,
    action: "tts_chars",
    cost: textLength,
    dailyLimit: getDailyTtsCharLimit(),
    meta,
  });

  if (!result.allowed) {
    throw new DailyQuotaExceededError("DAILY_TTS_CHAR_LIMIT_EXCEEDED");
  }

  return result;
}
