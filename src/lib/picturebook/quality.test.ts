import { describe, expect, it } from "vitest";

import {
  isQualityApproved,
  parseQualityReview,
  QUALITY_CRITERIA,
  type QualityReview,
} from "./quality";

const sources = {
  "page:1": "별이는 토끼 인형을 꼭 안았어요. 창문이 조금 흔들렸어요.",
  "page:5": "작은 별을 향해 손을 내밀었어요.",
  "choice:A": "작은 별을 향해 손을 내밀어요.",
  "image:1": "A child with short black hair and pale yellow pajamas.",
  "visual-guide": "short black hair and pale yellow pajamas",
};
function approvedReview(): QualityReview {
  return {
    checks: QUALITY_CRITERIA.map(criterion => ({
      criterion,
      passed: true,
      reason: "주어진 장면에서 주인공의 작은 행동을 확인할 수 있어요.",
      evidence: [{ source: "page:1", quote: "토끼 인형을 꼭 안았어요." }],
      fix: "",
    })),
  };
}

function alteredCheck(patch: Record<string, unknown>) {
  const raw = approvedReview();
  return {
    checks: [{ ...raw.checks[0], ...patch }, ...raw.checks.slice(1)],
  };
}

describe("picturebook quality review contract", () => {
  it("approves only a complete review supported by exact source quotations", () => {
    const raw = approvedReview();
    raw.checks[1].evidence = [
      { source: "choice:A", quote: sources["choice:A"] },
      { source: "page:5", quote: sources["page:5"] },
    ];
    raw.checks[5].evidence = [
      { source: "image:1", quote: sources["visual-guide"] },
      { source: "visual-guide", quote: sources["visual-guide"] },
    ];
    expect(isQualityApproved(parseQualityReview(raw, sources))).toBe(true);
  });

  it("keeps an actionable failure without requiring evidence of an absence", () => {
    const raw = approvedReview();
    raw.checks[0] = {
      criterion: "input_fidelity",
      passed: false,
      reason: "입력에서 삽을 기다리던 친구가 원고에 나타나지 않아요.",
      evidence: [],
      fix: "1쪽에 빨간 삽을 쓰고 싶어 하는 친구와 아이를 함께 보여주세요.",
    };
    const review = parseQualityReview(raw, sources);
    expect(isQualityApproved(review)).toBe(false);
    expect(review.checks[0].fix).toContain("빨간 삽");
  });

  it.each([
    ["an omitted criterion", { checks: approvedReview().checks.slice(1) }],
    [
      "an extra check",
      { checks: [...approvedReview().checks, approvedReview().checks[0]] },
    ],
    ["a duplicate criterion", alteredCheck({ criterion: "choice_integrity" })],
    ["an unknown criterion", alteredCheck({ criterion: "overall" })],
    ["a string verdict", alteredCheck({ passed: "true" })],
    ["an empty reason", alteredCheck({ reason: "  " })],
    ["an oversized reason", alteredCheck({ reason: "가".repeat(801) })],
    ["an oversized fix", alteredCheck({ fix: "가".repeat(801) })],
    ["a verdict without evidence", alteredCheck({ evidence: [] })],
    ["a missing evidence array", alteredCheck({ evidence: undefined })],
    [
      "an empty quotation",
      alteredCheck({ evidence: [{ source: "page:1", quote: "  " }] }),
    ],
    [
      "an oversized quotation",
      alteredCheck({
        evidence: [{ source: "page:1", quote: "가".repeat(601) }],
      }),
    ],
    [
      "unbounded evidence",
      alteredCheck({
        evidence: Array(13).fill(approvedReview().checks[0].evidence[0]),
      }),
    ],
    ["a failure without a fix", alteredCheck({ passed: false, fix: "  " })],
    ["a self-issued overall approval", { ...approvedReview(), approved: true }],
  ])("rejects %s", (_, raw) => {
    expect(() => parseQualityReview(raw, sources)).toThrow();
  });

  it.each([
    ["page:2", sources["page:1"]],
    ["page:1", sources["page:5"]],
    ["page:1", "별이가 친구에게 삽을 건넸어요."],
    ["page:1", "토끼인형을꼭안았어요."],
    ["qualityNotes", "원고가 모두 자연스러워요."],
    ["__proto__", "unknown"],
  ])("rejects absent or fabricated evidence in %s", (source, quote) => {
    const raw = approvedReview();
    raw.checks[0].evidence = [{ source, quote }];
    expect(() => parseQualityReview(raw, sources)).toThrow();
  });

  it("does not treat inherited properties as supplied source text", () => {
    const inheritedSources = Object.create(sources);
    expect(() =>
      parseQualityReview(approvedReview(), inheritedSources),
    ).toThrow();
  });

  it.each([null, {}, [], "approved", { checks: null }])(
    "rejects malformed review roots",
    raw => expect(() => parseQualityReview(raw, sources)).toThrow(),
  );

  it("does not approve an empty review even if called without the parser", () => {
    expect(isQualityApproved({ checks: [] })).toBe(false);
  });
});
