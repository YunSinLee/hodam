import { describe, expect, it } from "vitest";

import {
  resolveProfileKpiSummary,
  resolveProfileKpiWarningMessage,
} from "@/app/profile/profile-kpi-summary";

describe("resolveProfileKpiSummary", () => {
  it("returns numeric defaults when KPI arrays are empty", () => {
    expect(
      resolveProfileKpiSummary({
        kpiDaily: [],
        kpiRetentionDaily: [],
        kpiUserRetention: null,
      }),
    ).toEqual({
      latestCostPerStory: 0,
      latestAuthCallbackSuccess: 0,
      latestAuthCallbackError: 0,
      latestAuthCallbackSuccessGoogle: 0,
      latestAuthCallbackSuccessKakao: 0,
      latestAuthCallbackErrorGoogle: 0,
      latestAuthCallbackErrorKakao: 0,
      latestD1Retention: 0,
      latestD7Retention: 0,
      retainedD1: false,
      retainedD7: false,
    });
  });

  it("maps latest KPI rows into profile summary fields", () => {
    expect(
      resolveProfileKpiSummary({
        kpiDaily: [
          {
            metric_date: "2026-04-07",
            cost_per_story: "0.42",
            auth_callback_success: 9,
            auth_callback_error: 2,
            auth_callback_success_google: 5,
            auth_callback_success_kakao: 4,
            auth_callback_error_google: 1,
            auth_callback_error_kakao: 1,
          },
        ],
        kpiRetentionDaily: [
          {
            cohort_date: "2026-04-01",
            cohort_size: 20,
            d1_retained_users: 7,
            d7_retained_users: 3,
            d1_retention_rate: "0.35",
            d7_retention_rate: 0.15,
          },
        ],
        kpiUserRetention: {
          user_id: "user-1",
          cohort_date: "2026-04-01",
          retained_d1: true,
          retained_d7: false,
          cohort_age_days: 6,
        },
      }),
    ).toEqual({
      latestCostPerStory: 0.42,
      latestAuthCallbackSuccess: 9,
      latestAuthCallbackError: 2,
      latestAuthCallbackSuccessGoogle: 5,
      latestAuthCallbackSuccessKakao: 4,
      latestAuthCallbackErrorGoogle: 1,
      latestAuthCallbackErrorKakao: 1,
      latestD1Retention: 0.35,
      latestD7Retention: 0.15,
      retainedD1: true,
      retainedD7: false,
    });
  });
});

describe("resolveProfileKpiWarningMessage", () => {
  it("returns null when diagnostics are healthy", () => {
    expect(resolveProfileKpiWarningMessage(false, ["rpc_error"])).toBeNull();
  });

  it("returns fallback reason text when degraded without reasons", () => {
    expect(resolveProfileKpiWarningMessage(true, [])).toBe(
      "일부 KPI 지표는 보조 경로로 조회되었습니다. (reasons=unknown)",
    );
  });

  it("returns joined reasons when degraded", () => {
    expect(
      resolveProfileKpiWarningMessage(true, ["rpc_error", "fallback"]),
    ).toBe(
      "일부 KPI 지표는 보조 경로로 조회되었습니다. (reasons=rpc_error, fallback)",
    );
  });
});
