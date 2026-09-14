import type {
  KpiDailyItem,
  KpiRetentionDailyItem,
  KpiUserRetention,
} from "@/app/api/v1/types";
import { toNumberLike } from "@/lib/ui/profile-metrics";

export interface ProfileKpiSummary {
  latestCostPerStory: number;
  latestAuthCallbackSuccess: number;
  latestAuthCallbackError: number;
  latestAuthCallbackSuccessGoogle: number;
  latestAuthCallbackSuccessKakao: number;
  latestAuthCallbackErrorGoogle: number;
  latestAuthCallbackErrorKakao: number;
  latestD1Retention: number;
  latestD7Retention: number;
  retainedD1: boolean;
  retainedD7: boolean;
}

interface ResolveProfileKpiSummaryParams {
  kpiDaily: KpiDailyItem[];
  kpiRetentionDaily: KpiRetentionDailyItem[];
  kpiUserRetention: KpiUserRetention | null;
}

export function resolveProfileKpiSummary({
  kpiDaily,
  kpiRetentionDaily,
  kpiUserRetention,
}: ResolveProfileKpiSummaryParams): ProfileKpiSummary {
  const latestKpiDaily = kpiDaily[0] || null;
  const latestKpiRetention = kpiRetentionDaily[0] || null;

  return {
    latestCostPerStory: toNumberLike(latestKpiDaily?.cost_per_story),
    latestAuthCallbackSuccess: toNumberLike(
      latestKpiDaily?.auth_callback_success,
    ),
    latestAuthCallbackError: toNumberLike(latestKpiDaily?.auth_callback_error),
    latestAuthCallbackSuccessGoogle: toNumberLike(
      latestKpiDaily?.auth_callback_success_google,
    ),
    latestAuthCallbackSuccessKakao: toNumberLike(
      latestKpiDaily?.auth_callback_success_kakao,
    ),
    latestAuthCallbackErrorGoogle: toNumberLike(
      latestKpiDaily?.auth_callback_error_google,
    ),
    latestAuthCallbackErrorKakao: toNumberLike(
      latestKpiDaily?.auth_callback_error_kakao,
    ),
    latestD1Retention: toNumberLike(latestKpiRetention?.d1_retention_rate),
    latestD7Retention: toNumberLike(latestKpiRetention?.d7_retention_rate),
    retainedD1: Boolean(kpiUserRetention?.retained_d1),
    retainedD7: Boolean(kpiUserRetention?.retained_d7),
  };
}

export function resolveProfileKpiWarningMessage(
  degraded: boolean,
  reasons: string[],
): string | null {
  if (!degraded) {
    return null;
  }

  const reasonText = reasons.length > 0 ? reasons.join(", ") : "unknown";
  return `일부 KPI 지표는 보조 경로로 조회되었습니다. (reasons=${reasonText})`;
}
