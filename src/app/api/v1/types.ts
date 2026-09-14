import {
  AuthCallbackMetricEventSchema,
  AuthCallbackRecentMetricsResponseSchema,
  AuthProviderStatusSchema,
  AuthProvidersResponseSchema,
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
  PaymentTimelineEventSchema,
  PaymentTimelineResponseSchema,
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
export type AuthProviderStatus = z.infer<typeof AuthProviderStatusSchema>;
export type AuthProvidersResponse = z.infer<typeof AuthProvidersResponseSchema>;
export type AuthCallbackMetricEvent = z.infer<
  typeof AuthCallbackMetricEventSchema
>;
export type AuthCallbackRecentMetricsResponse = z.infer<
  typeof AuthCallbackRecentMetricsResponseSchema
>;
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
export type PaymentTimelineEvent = z.infer<typeof PaymentTimelineEventSchema>;
export type PaymentTimelineResponse = z.infer<
  typeof PaymentTimelineResponseSchema
>;
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

export type StoryStartErrorCode =
  | "AUTH_UNAUTHORIZED"
  | "REQUEST_JSON_INVALID"
  | "STORY_START_RATE_LIMITED"
  | "STORY_START_KEYWORDS_TYPE_INVALID"
  | "STORY_START_KEYWORDS_INPUT_TOO_LONG"
  | "STORY_START_KEYWORDS_REQUIRED"
  | "STORY_START_KEYWORDS_TOO_MANY"
  | "STORY_START_KEYWORD_TOO_LONG"
  | "STORY_START_BLOCKED_TOPIC"
  | "STORY_START_BLOCKED_OUTPUT"
  | "AI_SERVICE_NOT_CONFIGURED"
  | "AI_DAILY_BUDGET_EXCEEDED"
  | "BEADS_INSUFFICIENT"
  | "STORY_START_FAILED";

export type StoryContinueErrorCode =
  | "AUTH_UNAUTHORIZED"
  | "REQUEST_JSON_INVALID"
  | "STORY_CONTINUE_RATE_LIMITED"
  | "STORY_CONTINUE_THREAD_ID_INVALID"
  | "STORY_CONTINUE_SELECTION_REQUIRED"
  | "STORY_CONTINUE_SELECTION_TOO_LONG"
  | "STORY_CONTINUE_BLOCKED_TOPIC"
  | "STORY_CONTINUE_BLOCKED_OUTPUT"
  | "AI_SERVICE_NOT_CONFIGURED"
  | "AI_DAILY_BUDGET_EXCEEDED"
  | "BEADS_INSUFFICIENT"
  | "THREAD_NOT_FOUND"
  | "STORY_CONTINUE_FAILED";

export type StoryTranslateErrorCode =
  | "AUTH_UNAUTHORIZED"
  | "REQUEST_JSON_INVALID"
  | "STORY_TRANSLATE_RATE_LIMITED"
  | "STORY_TRANSLATE_THREAD_ID_INVALID"
  | "STORY_TRANSLATE_BLOCKED_OUTPUT"
  | "AI_SERVICE_NOT_CONFIGURED"
  | "AI_DAILY_BUDGET_EXCEEDED"
  | "BEADS_INSUFFICIENT"
  | "THREAD_NOT_FOUND"
  | "STORY_TRANSLATE_FAILED";
