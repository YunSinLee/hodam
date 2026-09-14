import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  checkRateLimit,
  configureRateLimitForTests,
  getRateLimitBucketCountForTests,
  resetRateLimitBucketsForTests,
} from "@/lib/server/rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    resetRateLimitBucketsForTests();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests up to maxRequests and blocks overflow in window", () => {
    expect(checkRateLimit("user:1", 3, 60_000)).toBe(true);
    expect(checkRateLimit("user:1", 3, 60_000)).toBe(true);
    expect(checkRateLimit("user:1", 3, 60_000)).toBe(true);
    expect(checkRateLimit("user:1", 3, 60_000)).toBe(false);
  });

  it("allows requests again after the time window has passed", () => {
    expect(checkRateLimit("user:1", 1, 1_000)).toBe(true);
    expect(checkRateLimit("user:1", 1, 1_000)).toBe(false);

    vi.advanceTimersByTime(1_001);

    expect(checkRateLimit("user:1", 1, 1_000)).toBe(true);
  });

  it("prunes stale buckets when ttl has elapsed", () => {
    configureRateLimitForTests({
      staleBucketTtlMs: 2_000,
      pruneIntervalMs: 0,
    });

    expect(checkRateLimit("user:old", 5, 1_000)).toBe(true);
    expect(getRateLimitBucketCountForTests()).toBe(1);

    vi.advanceTimersByTime(2_100);

    expect(checkRateLimit("user:new", 5, 1_000)).toBe(true);
    expect(getRateLimitBucketCountForTests()).toBe(1);
  });

  it("caps bucket count to prevent unbounded growth", () => {
    configureRateLimitForTests({
      maxBucketKeys: 3,
      pruneIntervalMs: 0,
    });

    expect(checkRateLimit("k1", 1, 60_000)).toBe(true);
    expect(checkRateLimit("k2", 1, 60_000)).toBe(true);
    expect(checkRateLimit("k3", 1, 60_000)).toBe(true);
    expect(getRateLimitBucketCountForTests()).toBe(3);

    expect(checkRateLimit("k4", 1, 60_000)).toBe(true);
    expect(getRateLimitBucketCountForTests()).toBe(3);
  });
});
