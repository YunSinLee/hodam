import type {
  KpiDailyItem,
  KpiRetentionDailyItem,
  KpiUserRetention,
} from "@/app/api/v1/types";
import { resolveProfileKpiWarningMessage } from "@/app/profile/profile-kpi-summary";
import analyticsApi, { type KpiResult } from "@/lib/client/api/analytics";
import paymentApi, {
  type PaymentHistory as PaymentHistoryItem,
} from "@/lib/client/api/payment";
import profileApi, {
  type PaymentHistory,
  type RecentStory,
  type UserProfile,
  type UserStats,
} from "@/lib/client/api/profile";

export const PROFILE_KPI_LOAD_ERROR_MESSAGE =
  "활동 KPI를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.";

export interface ProfilePageDataSnapshot {
  profile: UserProfile | null;
  stats: UserStats | null;
  recentStories: RecentStory[];
  paymentHistory: PaymentHistory[];
  kpiDaily: KpiDailyItem[];
  kpiRetentionDaily: KpiRetentionDailyItem[];
  kpiUserRetention: KpiUserRetention | null;
  kpiWarningMessage: string | null;
}

interface ProfilePageDataLoaderDeps {
  getProfileSummary: typeof profileApi.getProfileSummary;
  getPaymentHistory: typeof paymentApi.getPaymentHistory;
  getKpi: typeof analyticsApi.getKpi;
  resolveKpiWarningMessage: (
    degraded: boolean,
    reasons: string[],
  ) => string | null;
}

const DEFAULT_DEPS: ProfilePageDataLoaderDeps = {
  getProfileSummary: limit => profileApi.getProfileSummary(limit),
  getPaymentHistory: () => paymentApi.getPaymentHistory(),
  getKpi: days => analyticsApi.getKpi(days),
  resolveKpiWarningMessage: (degraded, reasons) =>
    resolveProfileKpiWarningMessage(degraded, reasons),
};

function toRecentPaymentHistory(
  paymentHistory: PaymentHistoryItem[],
  limit: number,
): PaymentHistory[] {
  return paymentHistory.slice(0, limit).map(item => ({
    id: item.id,
    bead_quantity: item.bead_quantity,
    amount: item.amount,
    created_at: item.created_at,
    status: item.status,
  }));
}

function toKpiSnapshot(
  kpiResult: KpiResult,
  resolveWarningMessage: ProfilePageDataLoaderDeps["resolveKpiWarningMessage"],
): Pick<
  ProfilePageDataSnapshot,
  "kpiDaily" | "kpiRetentionDaily" | "kpiUserRetention" | "kpiWarningMessage"
> {
  return {
    kpiDaily: kpiResult.data.daily || [],
    kpiRetentionDaily: kpiResult.data.retentionDaily || [],
    kpiUserRetention: kpiResult.data.userRetention || null,
    kpiWarningMessage: resolveWarningMessage(
      kpiResult.diagnostics.degraded,
      kpiResult.diagnostics.reasons,
    ),
  };
}

export async function loadProfilePageData(
  deps: ProfilePageDataLoaderDeps = DEFAULT_DEPS,
): Promise<ProfilePageDataSnapshot> {
  const [summary, paymentsData] = await Promise.all([
    deps.getProfileSummary(5),
    deps.getPaymentHistory(),
  ]);

  try {
    const kpi = await deps.getKpi(14);
    return {
      profile: summary.profile,
      stats: summary.stats,
      recentStories: summary.recentStories,
      paymentHistory: toRecentPaymentHistory(paymentsData, 5),
      ...toKpiSnapshot(kpi, deps.resolveKpiWarningMessage),
    };
  } catch {
    return {
      profile: summary.profile,
      stats: summary.stats,
      recentStories: summary.recentStories,
      paymentHistory: toRecentPaymentHistory(paymentsData, 5),
      kpiDaily: [],
      kpiRetentionDaily: [],
      kpiUserRetention: null,
      kpiWarningMessage: PROFILE_KPI_LOAD_ERROR_MESSAGE,
    };
  }
}
