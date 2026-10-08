// Standard API prices checked 2026-10-07. No images, tools or premium tiers.
export const PRICES = {
  "gpt-5.4-2026-03-05": { input: 2.5, cached: 0.25, output: 15 },
  "gpt-6-luna": { input: 0.1, cached: 0.01, output: 0.5, write: 0.125 },
  "gpt-6.1-sol": { input: 2, cached: 0.1, output: 10, write: 2.5 },
};

export const VARIANTS = [
  {
    id: "baseline",
    writer: "gpt-5.4-2026-03-05",
    reviewer: "gpt-5.4-2026-03-05",
  },
  { id: "candidate", writer: "gpt-6-luna", reviewer: "gpt-6.1-sol" },
];

export function comparisonParams(params) {
  if (!Object.hasOwn(PRICES, params.model))
    throw new Error("Unsupported comparison model");
  // The same low effort as production. The output ceiling is evaluation-only.
  const { temperature, top_p, ...rest } = params;
  return {
    ...rest,
    reasoning_effort: "low",
    max_completion_tokens: 6000,
    service_tier: "default",
  };
}

const count = value => Number.isSafeInteger(value) && value >= 0;

export function usageCost(model, usage) {
  const price = PRICES[model];
  if (
    !price ||
    !count(usage?.prompt_tokens) ||
    !count(usage?.completion_tokens)
  )
    return null;
  const input = usage.prompt_tokens;
  const output = usage.completion_tokens;
  const cached = usage.prompt_tokens_details?.cached_tokens;
  if (cached !== undefined && (!count(cached) || cached > input)) return null;
  // Provider usage may omit cache-write details. Keep a range in that case.
  const writes =
    usage.prompt_tokens_details?.cache_write_tokens ?? usage.cache_write_tokens;
  if (
    writes !== undefined &&
    (!count(writes) || writes > input - (cached ?? 0))
  )
    return null;
  const minCached = cached ?? 0;
  const maxCached = cached ?? input;
  const minWrites = writes ?? 0;
  const maxWrites = price.write ? writes ?? input - minCached : 0;
  const cost = (c, w) =>
    ((input - c - w) * price.input +
      c * price.cached +
      w * (price.write ?? price.input) +
      output * price.output) /
    1e6;
  return {
    lower: cost(maxCached, Math.min(minWrites, input - maxCached)),
    upper: cost(minCached, maxWrites),
    inputTokens: input,
    outputTokens: output,
    // Reasoning tokens are already included in completion_tokens.
    reasoningTokens: usage.completion_tokens_details?.reasoning_tokens ?? null,
  };
}

export function reserveCost(params) {
  const price = PRICES[params.model];
  if (
    !price ||
    !count(params.max_completion_tokens) ||
    params.max_completion_tokens < 1
  )
    throw new Error("Missing output cap");
  // UTF-8 bytes conservatively bound text tokens, with room for chat/schema framing.
  const inputBound =
    Buffer.byteLength(
      JSON.stringify({
        messages: params.messages,
        response_format: params.response_format,
      }),
      "utf8",
    ) + 4096;
  if (inputBound > 272000)
    throw new Error("Comparison exceeds short-context price band");
  return (
    (inputBound * Math.max(price.input, price.write ?? 0) +
      params.max_completion_tokens * price.output) /
    1e6
  );
}

export function committedCost(calls) {
  return calls.reduce(
    (sum, call) => sum + (call.cost?.upper ?? call.reservedUSD),
    0,
  );
}

export function canReserve(calls, request, limit) {
  if (!Number.isFinite(limit) || limit <= 0 || limit > 10)
    throw new Error("Budget must be between $0 and $10");
  return committedCost(calls) + reserveCost(request) <= limit;
}

export function safeFailure(error) {
  const codes = [
    "invalid_api_key",
    "insufficient_quota",
    "credit_balance_exhausted",
    "model_not_found",
    "rate_limit_exceeded",
  ];
  return {
    name: [
      "APIConnectionTimeoutError",
      "APIConnectionError",
      "GenerationError",
      "BudgetLimitError",
    ].includes(error?.name)
      ? error.name
      : "ProviderOrPipelineError",
    status: Number.isInteger(error?.status) ? error.status : null,
    code: codes.includes(error?.code) ? error.code : null,
  };
}

export function mustStop(error) {
  return (
    [401, 403, 404, 429].includes(error?.status) ||
    error?.name === "BudgetLimitError"
  );
}

/** Only an infrastructure rejection may be retried on an explicit later resume.
 * Timeouts, output/quality failures, budget limits and journal failures remain
 * terminal measurements. Retrying those would bias the model comparison.
 */
export function isRetryableInfrastructureFailure(
  error,
  { lastCallError, instrumentationFailed = false } = {},
) {
  if (instrumentationFailed) return false;
  const infrastructureError = failure =>
    [401, 403, 404, 429].includes(failure?.status) ||
    (failure?.status >= 500 && failure?.status <= 599) ||
    failure?.name === "APIConnectionError";
  if (infrastructureError(error)) return true;
  // Production wraps provider failures in GenerationError. Use only this
  // attempt's final recorded call, never a rejection from a previous attempt.
  return (
    error?.name === "GenerationError" && infrastructureError(lastCallError)
  );
}

/** Keep all attempts in the persisted ledger; select the latest terminal result
 * for pilot gates and task skipping. Successful and quality-failed tasks never
 * rerun. Older checkpoints without the marker remain terminal, conservatively.
 */
export function settledComparisonResults(results) {
  const latest = new Map();
  for (const result of results) {
    const key = JSON.stringify([result.kind, result.caseId, result.variant]);
    latest.set(key, result);
  }
  return [...latest.values()].filter(result => !result.infrastructureFailure);
}

export function percentile(values, quantile) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(quantile * sorted.length) - 1)];
}

export function summarize(results, calls, variants = VARIANTS) {
  return variants.map(variant => {
    const books = results.filter(
      r => r.kind === "story" && r.variant === variant.id,
    );
    const completed = books.filter(r => r.ok);
    const storyCalls = calls.filter(
      c => c.kind === "story" && c.variant === variant.id,
    );
    const fixtures = results.filter(
      r => r.kind === "fixture" && r.variant === variant.id,
    );
    const knownCost = storyCalls.reduce(
      (sum, c) => sum + (c.cost?.lower ?? 0),
      0,
    );
    const upperCost = committedCost(storyCalls);
    return {
      variant: variant.id,
      attemptedBooks: books.length,
      completedBooks: completed.length,
      repairCalls: storyCalls.filter(c => c.phase === "repair").length,
      apiCalls: storyCalls.length,
      unknownCostCalls: storyCalls.filter(c => !c.cost).length,
      costLowerUSD: knownCost,
      costUpperUSD: upperCost,
      costPerCompletedBookUSD: completed.length
        ? [knownCost / completed.length, upperCost / completed.length]
        : null,
      completeBookP50ms: percentile(
        completed.map(r => r.ms),
        0.5,
      ),
      completeBookP95ms: percentile(
        completed.map(r => r.ms),
        0.95,
      ),
      fixtureVerdicts: {
        correct: fixtures.filter(r => r.matches).length,
        total: fixtures.length,
      },
      falseAccepts: fixtures.filter(
        r => !r.expectedApproved && r.approved === true,
      ).length,
      falseRejects: fixtures.filter(
        r => r.expectedApproved && r.approved === false,
      ).length,
      fixtureErrors: fixtures.filter(r => r.error).length,
    };
  });
}
