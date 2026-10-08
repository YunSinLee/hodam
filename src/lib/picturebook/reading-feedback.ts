import { z } from "zod";

export const feedbackRatings = ["again", "disappointed"] as const;
export const feedbackReasons = [
  "story",
  "illustrations",
  "personalization",
  "length",
  "language",
] as const;

export type FeedbackRating = (typeof feedbackRatings)[number];
export type FeedbackReason = (typeof feedbackReasons)[number];

export const feedbackReasonOptions: Record<
  FeedbackRating,
  { value: FeedbackReason; label: string }[]
> = {
  again: [
    { value: "story", label: "이야기가 재미있어요" },
    { value: "illustrations", label: "그림이 좋아요" },
    { value: "personalization", label: "우리 아이가 주인공이라 좋아요" },
  ],
  disappointed: [
    { value: "story", label: "이야기가 아쉬워요" },
    { value: "illustrations", label: "그림이 아쉬워요" },
    { value: "length", label: "길이가 안 맞아요" },
    { value: "language", label: "문장이 어려워요" },
  ],
};

export const ReadingFeedbackInputSchema = z
  .object({
    rating: z.enum(feedbackRatings),
    reason: z.enum(feedbackReasons).nullable().default(null),
  })
  .strict()
  .refine(
    value =>
      value.reason === null ||
      feedbackReasonOptions[value.rating].some(
        option => option.value === value.reason,
      ),
    { message: "Reason does not match the rating", path: ["reason"] },
  );

export const ReadingFeedbackSchema = z.object({
  rating: z.enum(feedbackRatings),
  reason: z.enum(feedbackReasons).nullable(),
  updatedAt: z.string().datetime({ offset: true }),
});

export const ReadingFeedbackResponseSchema = z.object({
  feedback: ReadingFeedbackSchema.nullable(),
});

export type ReadingFeedbackInput = z.infer<typeof ReadingFeedbackInputSchema>;
export type SavedReadingFeedback = z.infer<typeof ReadingFeedbackSchema>;
