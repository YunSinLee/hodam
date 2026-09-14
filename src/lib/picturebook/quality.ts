import { z } from "zod";

export const QUALITY_CRITERIA = [
  "input_fidelity",
  "choice_integrity",
  "continuity",
  "language",
  "read_aloud",
  "visual_consistency",
  "emotional_safety",
] as const;

const evidenceSchema = z
  .object({
    source: z
      .string()
      .regex(/^(?:page:[1-8]|image:[1-8]|choice:[ABC]|visual-guide)$/),
    quote: z.string().trim().min(1).max(600),
  })
  .strict();

const reviewSchema = z
  .object({
    checks: z
      .array(
        z
          .object({
            criterion: z.enum(QUALITY_CRITERIA),
            passed: z.boolean(),
            reason: z.string().trim().min(1).max(800),
            evidence: z.array(evidenceSchema).max(12),
            fix: z.string().trim().max(800),
          })
          .strict(),
      )
      .length(QUALITY_CRITERIA.length),
  })
  .strict();

export type QualityReview = z.infer<typeof reviewSchema>;

/** Quotes ground the review in the candidate; they do not prove its semantics. */
export function parseQualityReview(
  raw: unknown,
  sources: Record<string, string>,
): QualityReview {
  const review = reviewSchema.parse(raw);
  const seen = new Set<string>();
  review.checks.forEach(check => {
    if (seen.has(check.criterion))
      throw new Error("Quality review contains duplicate criteria");
    seen.add(check.criterion);
    if (check.passed && check.evidence.length === 0)
      throw new Error("Approved quality checks require source evidence");
    if (!check.passed && !check.fix)
      throw new Error("Failed quality checks require a concrete correction");
    check.evidence.forEach(evidence => {
      if (
        !Object.prototype.hasOwnProperty.call(sources, evidence.source) ||
        typeof sources[evidence.source] !== "string" ||
        !sources[evidence.source].includes(evidence.quote)
      )
        throw new Error("Quality review evidence does not match its source");
    });
  });
  return review;
}

export function isQualityApproved(review: QualityReview): boolean {
  return (
    review.checks.length === QUALITY_CRITERIA.length &&
    review.checks.every(check => check.passed) &&
    QUALITY_CRITERIA.every(criterion =>
      review.checks.some(check => check.criterion === criterion),
    )
  );
}
