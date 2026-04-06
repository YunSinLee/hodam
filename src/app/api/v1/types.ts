import {
  BeadDtoSchema,
  BeadResponseSchema,
  ConfirmPaymentResponseSchema,
  KpiDailyItemSchema,
  KpiResponseSchema,
  KpiRetentionDailyItemSchema,
  KpiUserRetentionSchema,
  PaymentHistoryItemSchema,
  PaymentHistoryResponseSchema,
  PaymentStatusResponseSchema,
  PreparePaymentResponseSchema,
  ProfileSummaryResponseSchema,
  RecentStorySchema,
  ThreadDetailMessageSchema,
  ThreadDetailResponseSchema,
  ThreadListResponseSchema,
  UserProfileSchema,
  UserStatsSchema,
} from "@/app/api/v1/schemas";

import type { z } from "zod";

export type BeadDto = z.infer<typeof BeadDtoSchema>;
export type BeadResponse = z.infer<typeof BeadResponseSchema>;
export type ThreadDetailMessage = z.infer<typeof ThreadDetailMessageSchema>;
export type ThreadListResponse = z.infer<typeof ThreadListResponseSchema>;
export type ThreadDetailResponse = z.infer<typeof ThreadDetailResponseSchema>;
export type PreparePaymentResponse = z.infer<
  typeof PreparePaymentResponseSchema
>;
export type ConfirmPaymentResponse = z.infer<
  typeof ConfirmPaymentResponseSchema
>;
export type PaymentHistoryItem = z.infer<typeof PaymentHistoryItemSchema>;
export type PaymentHistoryResponse = z.infer<
  typeof PaymentHistoryResponseSchema
>;
export type PaymentStatusResponse = z.infer<typeof PaymentStatusResponseSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
export type UserStats = z.infer<typeof UserStatsSchema>;
export type RecentStory = z.infer<typeof RecentStorySchema>;
export type ProfileSummaryResponse = z.infer<
  typeof ProfileSummaryResponseSchema
>;
export type KpiDailyItem = z.infer<typeof KpiDailyItemSchema>;
export type KpiRetentionDailyItem = z.infer<typeof KpiRetentionDailyItemSchema>;
export type KpiUserRetention = z.infer<typeof KpiUserRetentionSchema>;
export type KpiResponse = z.infer<typeof KpiResponseSchema>;
