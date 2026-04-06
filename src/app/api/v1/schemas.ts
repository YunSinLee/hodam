import { z } from "zod";

export const KeywordSchema = z
  .object({
    id: z.number().int().optional().default(0),
    thread_id: z.number().int().optional().default(0),
    keyword: z.string(),
  })
  .passthrough();

export const ThreadUserSchema = z
  .object({
    id: z.string(),
    email: z.string(),
    display_name: z.string(),
  })
  .passthrough();

export const ThreadSchema = z
  .object({
    id: z.number().int().positive(),
    openai_thread_id: z.string().optional().default(""),
    created_at: z.string(),
    user_id: z.string(),
    able_english: z.boolean(),
    has_image: z.boolean(),
    raw_text: z.string().nullable().optional(),
  })
  .passthrough();

export const ThreadWithUserSchema = ThreadSchema.extend({
  user: ThreadUserSchema,
  keywords: z.array(KeywordSchema).default([]),
}).passthrough();

export const BeadDtoSchema = z
  .object({
    id: z.string(),
    user_id: z.string(),
    count: z.number(),
  })
  .passthrough();

export const BeadResponseSchema = z.object({
  bead: BeadDtoSchema,
});

export const ThreadDetailMessageSchema = z
  .object({
    id: z.number().int(),
    turn: z.number().int().nonnegative(),
    text: z.string(),
    text_en: z.string(),
    created_at: z.string(),
  })
  .passthrough();

export const ThreadListResponseSchema = z.object({
  threads: z.array(ThreadWithUserSchema),
});

export const ThreadDetailResponseSchema = z.object({
  thread: ThreadSchema,
  imageUrl: z.string().nullable(),
  messages: z.array(ThreadDetailMessageSchema),
});

export const BeadPackageSchema = z
  .object({
    id: z.string(),
    quantity: z.number().int().positive(),
    price: z.number().int().positive(),
    originalPrice: z.number().int().nonnegative(),
    discount: z.number().int().nonnegative(),
    popular: z.boolean(),
    description: z.string(),
  })
  .passthrough();

export const PreparePaymentResponseSchema = z.object({
  orderId: z.string(),
  amount: z.number().int().positive(),
  orderName: z.string(),
  package: BeadPackageSchema,
});

export const ConfirmPaymentResponseSchema = z.object({
  success: z.boolean(),
  paymentKey: z.string(),
  orderId: z.string(),
  amount: z.number().int().positive(),
  beadCount: z.number().int().nonnegative(),
  alreadyProcessed: z.boolean(),
  paymentStatus: z.string().optional(),
  approvedAt: z.string().nullable().optional(),
});

export const PaymentStatusResponseSchema = z.object({
  orderId: z.string(),
  status: z.enum(["pending", "completed", "failed", "cancelled"]),
  amount: z.number().int().nonnegative(),
  beadQuantity: z.number().int().nonnegative(),
  paymentKey: z.string().nullable().optional(),
  beadCount: z.number().int().nonnegative().optional(),
  alreadyProcessed: z.boolean().optional(),
  completedAt: z.string().nullable().optional(),
  providerStatus: z.string().optional(),
  reconciliationState: z
    .enum(["not_attempted", "pending", "settled", "amount_mismatch", "error"])
    .optional(),
});

export const PaymentHistoryItemSchema = z
  .object({
    id: z.string(),
    user_id: z.string(),
    order_id: z.string(),
    payment_key: z.string().optional(),
    amount: z.number().int().nonnegative(),
    bead_quantity: z.number().int().nonnegative(),
    status: z.enum(["pending", "completed", "failed", "cancelled"]),
    created_at: z.string(),
    completed_at: z.string().optional(),
  })
  .passthrough();

export const PaymentHistoryResponseSchema = z.object({
  payments: z.array(PaymentHistoryItemSchema),
});

export const UserProfileSchema = z
  .object({
    id: z.string(),
    email: z.string(),
    display_name: z.string(),
    profileUrl: z.string(),
    custom_profile_url: z.string().optional(),
    created_at: z.string(),
    totalStories: z.number().int().nonnegative(),
    totalBeadsPurchased: z.number().int().nonnegative(),
    totalBeadsUsed: z.number().int().nonnegative(),
  })
  .passthrough();

export const UserStatsSchema = z
  .object({
    totalStories: z.number().int().nonnegative(),
    totalBeadsPurchased: z.number().int().nonnegative(),
    totalBeadsUsed: z.number().int().nonnegative(),
    totalPaymentAmount: z.number().int().nonnegative(),
    joinDate: z.string(),
  })
  .passthrough();

export const RecentStorySchema = z
  .object({
    id: z.number().int().positive(),
    created_at: z.string(),
    able_english: z.boolean(),
    has_image: z.boolean(),
    keywords: z.array(KeywordSchema).default([]),
  })
  .passthrough();

export const ProfileSummaryResponseSchema = z.object({
  profile: UserProfileSchema.nullable(),
  stats: UserStatsSchema,
  recentStories: z.array(RecentStorySchema),
});

export const StoryMessageSchema = z
  .object({
    text: z.string(),
    text_en: z.string(),
  })
  .passthrough();

export const StorySelectionSchema = z
  .object({
    text: z.string(),
    text_en: z.string(),
  })
  .passthrough();

export const StartStoryResponseSchema = z.object({
  threadId: z.number().int().positive(),
  turn: z.number().int().nonnegative(),
  beadCount: z.number().int().nonnegative(),
  includeEnglish: z.boolean(),
  includeImage: z.boolean(),
  notice: z.string(),
  imageUrl: z.string().nullable(),
  messages: z.array(StoryMessageSchema),
  selections: z.array(StorySelectionSchema),
});

export const ContinueStoryResponseSchema = z.object({
  threadId: z.number().int().positive(),
  turn: z.number().int().nonnegative(),
  beadCount: z.number().int().nonnegative(),
  notice: z.string(),
  messages: z.array(StoryMessageSchema),
  selections: z.array(StorySelectionSchema),
});

export const TranslateStoryMessageSchema = z
  .object({
    id: z.number().int().positive(),
    text: z.string(),
    text_en: z.string(),
  })
  .passthrough();

export const TranslateStoryResponseSchema = z.object({
  threadId: z.number().int().positive(),
  beadCount: z.number().int().nonnegative(),
  messages: z.array(TranslateStoryMessageSchema),
});

export const TtsResponseSchema = z.object({
  audioDataArray: z.array(z.string()),
  contentType: z.string(),
});

const NumericLikeSchema = z.union([z.number(), z.string()]);

export const KpiDailyItemSchema = z
  .object({
    metric_date: z.string(),
    create_start: z.number().int().nonnegative().optional(),
    create_success: z.number().int().nonnegative().optional(),
    continue_step: z.number().int().nonnegative().optional(),
    translation_click: z.number().int().nonnegative().optional(),
    image_generated: z.number().int().nonnegative().optional(),
    purchase_prepare: z.number().int().nonnegative().optional(),
    purchase_success: z.number().int().nonnegative().optional(),
    ai_cost_total: z.number().int().nonnegative().optional(),
    tts_chars_total: z.number().int().nonnegative().optional(),
    cost_per_story: NumericLikeSchema.optional(),
  })
  .passthrough();

export const KpiRetentionDailyItemSchema = z
  .object({
    cohort_date: z.string(),
    cohort_size: z.number().int().nonnegative(),
    d1_retained_users: z.number().int().nonnegative(),
    d7_retained_users: z.number().int().nonnegative(),
    d1_retention_rate: NumericLikeSchema,
    d7_retention_rate: NumericLikeSchema,
  })
  .passthrough();

export const KpiUserRetentionSchema = z
  .object({
    user_id: z.string(),
    cohort_date: z.string(),
    retained_d1: z.boolean(),
    retained_d7: z.boolean(),
    cohort_age_days: z.number().int().nonnegative(),
  })
  .passthrough();

export const KpiResponseSchema = z.object({
  days: z.number().int().positive(),
  daily: z.array(KpiDailyItemSchema),
  retentionDaily: z.array(KpiRetentionDailyItemSchema),
  userRetention: KpiUserRetentionSchema.nullable(),
});

export const SuccessResponseSchema = z.object({
  success: z.literal(true),
});

export const ProfileImageUploadResponseSchema = SuccessResponseSchema.extend({
  imageUrl: z.string().optional(),
});
