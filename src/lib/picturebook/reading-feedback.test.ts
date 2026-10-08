import { describe, expect, it } from "vitest";

import { ReadingFeedbackInputSchema } from "./reading-feedback";

describe("bounded reading feedback", () => {
  it("accepts a rating without requiring a reason", () => {
    expect(ReadingFeedbackInputSchema.parse({ rating: "again" })).toEqual({
      rating: "again",
      reason: null,
    });
  });

  it.each([
    { rating: "again", reason: "length" },
    { rating: "disappointed", reason: "personalization" },
    { rating: "again", reason: "arbitrary free text" },
    { rating: "again", childName: "private child name" },
    { rating: "other" },
  ])("rejects invalid or private extra input %j", input => {
    expect(ReadingFeedbackInputSchema.safeParse(input).success).toBe(false);
  });
});
