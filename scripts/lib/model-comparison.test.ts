import { describe, expect, it } from "vitest";
import { validatePicturebookInput } from "../../src/app/utils/picturebook";
import { comparisonCases } from "../fixtures/model-comparison-cases.mjs";
import {
  canReserve,
  committedCost,
  comparisonParams,
  isRetryableInfrastructureFailure,
  reserveCost,
  safeFailure,
  settledComparisonResults,
  summarize,
  usageCost,
} from "./model-comparison.mjs";

describe("isolated paid model comparison", () => {
  it("covers all 24 valid age/mode situations and all choices", () => {
    expect(comparisonCases).toHaveLength(24);
    expect(new Set(comparisonCases.map(item => item.id)).size).toBe(24);
    for (const age of ["3-4", "5-7", "8+"]) {
      for (const mode of ["daily", "adventure"]) {
        expect(
          comparisonCases.filter(
            item => item.ageBand === age && item.mode === mode,
          ),
        ).toHaveLength(4);
      }
    }
    expect(new Set(comparisonCases.map(item => item.choice))).toEqual(
      new Set(["A", "B", "C"]),
    );
    for (const item of comparisonCases)
      expect(validatePicturebookInput(item.input)).toBeNull();
  });

  it("removes incompatible GPT-6 sampling and caps paid reasoning/output", () => {
    const result = comparisonParams({
      model: "gpt-6-luna",
      temperature: 0.75,
      top_p: 0.9,
      messages: [],
      response_format: { type: "json_object" },
    });
    expect(result).not.toHaveProperty("temperature");
    expect(result).not.toHaveProperty("top_p");
    expect(result).toMatchObject({
      reasoning_effort: "low",
      max_completion_tokens: 6000,
      service_tier: "default",
    });
    expect(() => comparisonParams({ model: "arbitrary" })).toThrow();
  });

  it("counts reasoning once and discounts only explicit cached input", () => {
    const result = usageCost("gpt-5.4-2026-03-05", {
      prompt_tokens: 1000,
      completion_tokens: 2000,
      prompt_tokens_details: { cached_tokens: 200 },
      completion_tokens_details: { reasoning_tokens: 700 },
    });
    expect(result?.lower).toBeCloseTo(0.03205);
    expect(result?.upper).toBeCloseTo(0.03205);
  });

  it("keeps unknown cache writes as a price range, not a false exact figure", () => {
    const result = usageCost("gpt-6.1-sol", {
      prompt_tokens: 1000,
      completion_tokens: 2000,
      prompt_tokens_details: { cached_tokens: 0 },
    });
    expect(result?.lower).toBeCloseTo(0.022);
    expect(result?.upper).toBeCloseTo(0.0225);
    expect(usageCost("gpt-6-luna", undefined)).toBeNull();
    expect(
      usageCost("gpt-6-luna", {
        prompt_tokens: 5,
        completion_tokens: 2,
        prompt_tokens_details: { cached_tokens: 8 },
      }),
    ).toBeNull();
  });

  it("retains reservations for interrupted or timeout requests on resume", () => {
    const request = comparisonParams({
      model: "gpt-5.4-2026-03-05",
      messages: [{ role: "user", content: "한국어 동화" }],
    });
    const reservation = reserveCost(request);
    const savedCalls = JSON.parse(
      JSON.stringify([{ reservedUSD: reservation, outcome: "pending" }]),
    );
    expect(committedCost(savedCalls)).toBe(reservation);
    expect(canReserve(savedCalls, request, reservation * 1.5)).toBe(false);
    expect(canReserve(savedCalls, request, reservation * 2 + 0.001)).toBe(true);
    expect(() => canReserve([], request, 11)).toThrow();
  });

  it("reserves more for large Korean inputs and refuses long-context prices", () => {
    const base = comparisonParams({
      model: "gpt-6.1-sol",
      messages: [{ role: "user", content: "안녕" }],
    });
    expect(
      reserveCost({
        ...base,
        messages: [{ role: "user", content: "안녕".repeat(1000) }],
      }),
    ).toBeGreaterThan(reserveCost(base));
    expect(() =>
      reserveCost({
        ...base,
        messages: [{ role: "user", content: "안녕".repeat(50000) }],
      }),
    ).toThrow();
  });

  it("includes failed generation cost per completed book and marks reviewer errors", () => {
    const result = summarize(
      [
        { kind: "story", variant: "baseline", ok: false, ms: 20000 },
        { kind: "story", variant: "baseline", ok: true, ms: 40000 },
        {
          kind: "fixture",
          variant: "baseline",
          expectedApproved: false,
          approved: true,
        },
        {
          kind: "fixture",
          variant: "baseline",
          expectedApproved: true,
          error: {},
        },
      ],
      [
        { kind: "story", variant: "baseline", reservedUSD: 0.1 },
        {
          kind: "story",
          variant: "baseline",
          cost: { lower: 0.2, upper: 0.2 },
        },
      ],
    )[0];
    expect(result.completedBooks).toBe(1);
    expect(result.attemptedBooks).toBe(2);
    expect(result.costPerCompletedBookUSD?.[1]).toBeCloseTo(0.3);
    expect(result.unknownCostCalls).toBe(1);
    expect(result.falseAccepts).toBe(1);
    expect(result.fixtureErrors).toBe(1);
  });

  it("never persists raw provider error messages or arbitrary codes", () => {
    expect(
      JSON.stringify(
        safeFailure({
          message: "sensitive",
          code: "sensitive",
          name: "sensitive",
          status: 401,
        }),
      ),
    ).not.toContain("sensitive");
    expect(safeFailure({ status: 401, code: "invalid_api_key" })).toMatchObject(
      { status: 401, code: "invalid_api_key" },
    );
  });

  it("retries only recoverable infrastructure failures, including wrapped quota rejection", () => {
    expect(
      isRetryableInfrastructureFailure({
        status: 429,
        code: "credit_balance_exhausted",
      }),
    ).toBe(true);
    expect(
      isRetryableInfrastructureFailure(
        { name: "GenerationError" },
        { lastCallError: { status: 429 } },
      ),
    ).toBe(true);
    expect(isRetryableInfrastructureFailure({ status: 503 })).toBe(true);
    expect(
      isRetryableInfrastructureFailure({ name: "APIConnectionError" }),
    ).toBe(true);
    expect(isRetryableInfrastructureFailure({ name: "GenerationError" })).toBe(
      false,
    );
    expect(
      isRetryableInfrastructureFailure({ name: "APIConnectionTimeoutError" }),
    ).toBe(false);
    expect(isRetryableInfrastructureFailure({ name: "BudgetLimitError" })).toBe(
      false,
    );
    expect(isRetryableInfrastructureFailure({ status: 400 })).toBe(false);
    expect(
      isRetryableInfrastructureFailure(
        { name: "GenerationError" },
        { lastCallError: { status: 429 }, instrumentationFailed: true },
      ),
    ).toBe(false);
  });

  it("resumes the blocked arm and preserves the original attempt and spend reservation", () => {
    const quotaFailure = {
      kind: "story",
      caseId: "pilot",
      variant: "baseline",
      ok: false,
      infrastructureFailure: true,
    };
    const candidate = {
      kind: "story",
      caseId: "pilot",
      variant: "candidate",
      ok: true,
    };
    const results = [quotaFailure, candidate];
    const calls = [{ reservedUSD: 0.13, outcome: "error" }];
    expect(settledComparisonResults(results)).toEqual([candidate]);
    expect(results).toHaveLength(2);
    expect(committedCost(calls)).toBe(0.13);
    const resumed = { ...quotaFailure, ok: true, infrastructureFailure: false };
    results.push(resumed);
    expect(settledComparisonResults(results)).toEqual([resumed, candidate]);
    expect(settledComparisonResults(results).every(result => result.ok)).toBe(
      true,
    );
    expect(results[0]).toBe(quotaFailure);
    expect(committedCost(calls)).toBe(0.13);
  });

  it("keeps quality and legacy failures terminal and never lets an old infra error hide them", () => {
    const key = { kind: "story", caseId: "pilot", variant: "baseline" };
    const infra = { ...key, ok: false, infrastructureFailure: true };
    const quality = { ...key, ok: false, infrastructureFailure: false };
    const legacy = {
      kind: "fixture",
      caseId: "fixture",
      variant: "baseline",
      error: { name: "GenerationError" },
    };
    expect(settledComparisonResults([infra, quality, legacy])).toEqual([
      quality,
      legacy,
    ]);
    expect(
      settledComparisonResults([infra, quality]).some(result => !result.ok),
    ).toBe(true);
  });
});
