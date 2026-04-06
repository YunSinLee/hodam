import { supabase } from "@/app/utils/supabase";
import {
  toSessionUserInfo,
  type SessionUserInfo,
} from "@/lib/auth/session-state";

const DEFAULT_MAX_ATTEMPTS = 6;
const DEFAULT_RETRY_DELAY_MS = process.env.NODE_ENV === "test" ? 1 : 250;

export interface RecoverSessionUserOptions {
  maxAttempts?: number;
  retryDelayMs?: number;
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

async function recoverSessionUserInfoAttempt(
  attempt: number,
  maxAttempts: number,
  retryDelayMs: number,
): Promise<SessionUserInfo | null> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (!error) {
      const sessionUserInfo = toSessionUserInfo(data?.session || null);
      if (sessionUserInfo?.id) {
        return sessionUserInfo;
      }
    }
  } catch {
    // Ignore transient auth read failures and continue retrying.
  }

  if (attempt >= maxAttempts) {
    return null;
  }

  if (retryDelayMs > 0) {
    await wait(retryDelayMs);
  }

  return recoverSessionUserInfoAttempt(attempt + 1, maxAttempts, retryDelayMs);
}

export async function recoverSessionUserInfo(
  options: RecoverSessionUserOptions = {},
): Promise<SessionUserInfo | null> {
  const maxAttempts = Number.isFinite(options.maxAttempts)
    ? Math.max(1, Math.floor(options.maxAttempts as number))
    : DEFAULT_MAX_ATTEMPTS;
  const retryDelayMs = Number.isFinite(options.retryDelayMs)
    ? Math.max(0, Math.floor(options.retryDelayMs as number))
    : DEFAULT_RETRY_DELAY_MS;

  return recoverSessionUserInfoAttempt(1, maxAttempts, retryDelayMs);
}
