const buckets = new Map<string, number[]>();

const DEFAULT_MAX_BUCKET_KEYS = Number(
  process.env.HODAM_RATE_LIMIT_MAX_BUCKET_KEYS || 10_000,
);
const DEFAULT_STALE_BUCKET_TTL_MS = Number(
  process.env.HODAM_RATE_LIMIT_STALE_BUCKET_TTL_MS || 10 * 60_000,
);
const DEFAULT_PRUNE_INTERVAL_MS = Number(
  process.env.HODAM_RATE_LIMIT_PRUNE_INTERVAL_MS || 60_000,
);

let maxBucketKeys = Number.isFinite(DEFAULT_MAX_BUCKET_KEYS)
  ? DEFAULT_MAX_BUCKET_KEYS
  : 10_000;
let staleBucketTtlMs = Number.isFinite(DEFAULT_STALE_BUCKET_TTL_MS)
  ? DEFAULT_STALE_BUCKET_TTL_MS
  : 10 * 60_000;
let pruneIntervalMs = Number.isFinite(DEFAULT_PRUNE_INTERVAL_MS)
  ? DEFAULT_PRUNE_INTERVAL_MS
  : 60_000;
let lastPruneAt = 0;

function pruneBuckets(now: number) {
  const shouldSkipByInterval = now - lastPruneAt < pruneIntervalMs;
  if (shouldSkipByInterval && buckets.size <= maxBucketKeys) {
    return;
  }

  lastPruneAt = now;
  const staleCutoff = now - staleBucketTtlMs;

  Array.from(buckets.entries()).forEach(([key, timestamps]) => {
    const nextTimestamps = timestamps.filter(ts => ts > staleCutoff);
    if (nextTimestamps.length === 0) {
      buckets.delete(key);
      return;
    }
    buckets.set(key, nextTimestamps);
  });

  const overflow = buckets.size - maxBucketKeys;
  if (overflow <= 0) return;

  Array.from(buckets.keys())
    .slice(0, overflow)
    .forEach(key => {
      buckets.delete(key);
    });
}

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  pruneBuckets(now);
  const cutoff = now - windowMs;
  const current = buckets.get(key) ?? [];
  const next = current.filter(ts => ts > cutoff);

  if (next.length >= maxRequests) {
    buckets.set(key, next);
    return false;
  }

  next.push(now);
  buckets.set(key, next);
  pruneBuckets(now);
  return true;
}

export function resetRateLimitBucketsForTests() {
  buckets.clear();
  lastPruneAt = 0;
  maxBucketKeys = Number.isFinite(DEFAULT_MAX_BUCKET_KEYS)
    ? DEFAULT_MAX_BUCKET_KEYS
    : 10_000;
  staleBucketTtlMs = Number.isFinite(DEFAULT_STALE_BUCKET_TTL_MS)
    ? DEFAULT_STALE_BUCKET_TTL_MS
    : 10 * 60_000;
  pruneIntervalMs = Number.isFinite(DEFAULT_PRUNE_INTERVAL_MS)
    ? DEFAULT_PRUNE_INTERVAL_MS
    : 60_000;
}

export function configureRateLimitForTests(options: {
  maxBucketKeys?: number;
  staleBucketTtlMs?: number;
  pruneIntervalMs?: number;
}) {
  if (
    typeof options.maxBucketKeys === "number" &&
    Number.isFinite(options.maxBucketKeys) &&
    options.maxBucketKeys > 0
  ) {
    maxBucketKeys = options.maxBucketKeys;
  }

  if (
    typeof options.staleBucketTtlMs === "number" &&
    Number.isFinite(options.staleBucketTtlMs) &&
    options.staleBucketTtlMs > 0
  ) {
    staleBucketTtlMs = options.staleBucketTtlMs;
  }

  if (
    typeof options.pruneIntervalMs === "number" &&
    Number.isFinite(options.pruneIntervalMs) &&
    options.pruneIntervalMs >= 0
  ) {
    pruneIntervalMs = options.pruneIntervalMs;
  }
}

export function getRateLimitBucketCountForTests() {
  return buckets.size;
}
