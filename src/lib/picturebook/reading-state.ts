import { z } from "zod";

const version = z.number().int().min(0).max(2147483646);
const threadId = z.number().int().positive().safe();

export const ReadingProgressSchema = z
  .object({
    pageIndex: z.number().int().min(0).max(99),
    pageCount: z.number().int().min(1).max(100),
    completed: z.boolean(),
  })
  .strict()
  .refine(value => value.pageIndex < value.pageCount, {
    message: "Page must be within this book",
  });

export const ReadingStateBookSchema = z.object({
  threadId,
  favorite: z.boolean(),
  favoriteVersion: version,
  progress: z
    .object({
      pageIndex: z.number().int().min(0).max(99),
      pageCount: z.number().int().min(1).max(100),
      completed: z.boolean(),
      updatedAt: z.string().datetime({ offset: true }),
    })
    .refine(value => value.pageIndex < value.pageCount)
    .nullable(),
  progressVersion: version,
});

export const ReadingStateInputSchema = z.discriminatedUnion("field", [
  z
    .object({
      field: z.literal("favorite"),
      expectedVersion: version,
      favorite: z.boolean(),
    })
    .strict(),
  z
    .object({
      field: z.literal("progress"),
      expectedVersion: version,
      progress: ReadingProgressSchema,
    })
    .strict(),
]);

export const ReadingStatePageSchema = z.object({
  books: z.array(ReadingStateBookSchema).max(200),
  nextCursor: threadId.nullable(),
});

export const ReadingStateSaveSchema = z.object({
  book: ReadingStateBookSchema,
  applied: z.boolean(),
});

export type ReadingProgress = z.infer<typeof ReadingProgressSchema>;
export type ReadingStateBook = z.infer<typeof ReadingStateBookSchema>;
export type ReadingStateInput = z.infer<typeof ReadingStateInputSchema>;
