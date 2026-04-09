import { ApiError } from "@/lib/client/api/http";

const RETRYABLE_STATUSES = new Set([500, 502, 503, 504]);

export interface StoryRequestRetryOptions {
  maxAttempts?: number;
  retryDelayMs?: number;
  shouldRetry?: (error: unknown, failedAttempt: number) => boolean;
}

export function isRetryableStoryRequestError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return RETRYABLE_STATUSES.has(error.status);
  }

  if (error instanceof TypeError) {
    return true;
  }

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

export async function runWithStoryRequestRetry<T>(
  request: () => Promise<T>,
  options: StoryRequestRetryOptions = {},
): Promise<T> {
  const maxAttempts =
    Number.isFinite(options.maxAttempts) && Number(options.maxAttempts) > 0
      ? Math.floor(Number(options.maxAttempts))
      : 2;
  const retryDelayMs =
    Number.isFinite(options.retryDelayMs) && Number(options.retryDelayMs) > 0
      ? Number(options.retryDelayMs)
      : 0;
  const shouldRetry = options.shouldRetry || isRetryableStoryRequestError;

  const attemptRequest = async (failedAttempt: number): Promise<T> => {
    try {
      return await request();
    } catch (error) {
      const nextFailedAttempt = failedAttempt + 1;
      if (
        nextFailedAttempt >= maxAttempts ||
        !shouldRetry(error, nextFailedAttempt)
      ) {
        throw error;
      }

      if (retryDelayMs > 0) {
        await sleep(retryDelayMs);
      }

      return attemptRequest(nextFailedAttempt);
    }
  };

  return attemptRequest(0);
}
