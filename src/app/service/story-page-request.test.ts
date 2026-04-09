import { describe, expect, it } from "vitest";

import {
  isRetryableStoryRequestError,
  runWithStoryRequestRetry,
} from "@/app/service/story-page-request";
import { ApiError } from "@/lib/client/api/http";

describe("story-page-request", () => {
  describe("isRetryableStoryRequestError", () => {
    it("returns true for transient api statuses", () => {
      expect(isRetryableStoryRequestError(new ApiError(503, "temporary"))).toBe(
        true,
      );
      expect(isRetryableStoryRequestError(new ApiError(500, "temporary"))).toBe(
        true,
      );
    });

    it("returns false for non-transient api statuses", () => {
      expect(
        isRetryableStoryRequestError(new ApiError(400, "bad request")),
      ).toBe(false);
      expect(
        isRetryableStoryRequestError(new ApiError(402, "payment required")),
      ).toBe(false);
    });

    it("returns true for network type errors", () => {
      expect(isRetryableStoryRequestError(new TypeError("fetch failed"))).toBe(
        true,
      );
    });
  });

  describe("runWithStoryRequestRetry", () => {
    it("retries once for retryable api error and resolves", async () => {
      let attempts = 0;

      const result = await runWithStoryRequestRetry(async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new ApiError(503, "temporary failure");
        }

        return "ok";
      });

      expect(result).toBe("ok");
      expect(attempts).toBe(2);
    });

    it("does not retry for non-retryable api error", async () => {
      let attempts = 0;

      await expect(
        runWithStoryRequestRetry(async () => {
          attempts += 1;
          throw new ApiError(400, "invalid payload");
        }),
      ).rejects.toBeInstanceOf(ApiError);

      expect(attempts).toBe(1);
    });

    it("honors maxAttempts for retryable errors", async () => {
      let attempts = 0;

      await expect(
        runWithStoryRequestRetry(
          async () => {
            attempts += 1;
            throw new TypeError("network unstable");
          },
          {
            maxAttempts: 3,
          },
        ),
      ).rejects.toBeInstanceOf(TypeError);

      expect(attempts).toBe(3);
    });
  });
});
