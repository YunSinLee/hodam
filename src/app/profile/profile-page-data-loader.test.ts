import { describe, expect, it, vi } from "vitest";

import {
  loadProfilePageData,
  PROFILE_KPI_LOAD_ERROR_MESSAGE,
} from "@/app/profile/profile-page-data-loader";

describe("loadProfilePageData", () => {
  it("returns summary, limited payments and kpi snapshot", async () => {
    const result = await loadProfilePageData({
      getProfileSummary: vi.fn(async () => ({
        profile: {
          id: "user-1",
          email: "hodam@example.com",
          display_name: "호담",
          profileUrl: "",
          created_at: "2026-04-07T00:00:00.000Z",
          totalStories: 3,
          totalBeadsPurchased: 15,
          totalBeadsUsed: 6,
        },
        stats: {
          totalStories: 3,
          totalBeadsPurchased: 15,
          totalBeadsUsed: 6,
          totalPaymentAmount: 7500,
          joinDate: "2026-04-01",
        },
        recentStories: [],
      })),
      getPaymentHistory: vi.fn(async () => [
        {
          id: "p1",
          order_id: "o1",
          payment_key: "k1",
          amount: 1000,
          bead_quantity: 2,
          status: "completed",
          created_at: "2026-04-01T00:00:00.000Z",
          approved_at: null,
          package_id: "bead_2",
          payment_flow_id: "flow1",
        },
        {
          id: "p2",
          order_id: "o2",
          payment_key: "k2",
          amount: 2000,
          bead_quantity: 4,
          status: "completed",
          created_at: "2026-04-02T00:00:00.000Z",
          approved_at: null,
          package_id: "bead_4",
          payment_flow_id: "flow2",
        },
        {
          id: "p3",
          order_id: "o3",
          payment_key: "k3",
          amount: 3000,
          bead_quantity: 6,
          status: "completed",
          created_at: "2026-04-03T00:00:00.000Z",
          approved_at: null,
          package_id: "bead_6",
          payment_flow_id: "flow3",
        },
        {
          id: "p4",
          order_id: "o4",
          payment_key: "k4",
          amount: 4000,
          bead_quantity: 8,
          status: "completed",
          created_at: "2026-04-04T00:00:00.000Z",
          approved_at: null,
          package_id: "bead_8",
          payment_flow_id: "flow4",
        },
        {
          id: "p5",
          order_id: "o5",
          payment_key: "k5",
          amount: 5000,
          bead_quantity: 10,
          status: "completed",
          created_at: "2026-04-05T00:00:00.000Z",
          approved_at: null,
          package_id: "bead_10",
          payment_flow_id: "flow5",
        },
        {
          id: "p6",
          order_id: "o6",
          payment_key: "k6",
          amount: 6000,
          bead_quantity: 12,
          status: "completed",
          created_at: "2026-04-06T00:00:00.000Z",
          approved_at: null,
          package_id: "bead_12",
          payment_flow_id: "flow6",
        },
      ]),
      getKpi: vi.fn(async () => ({
        data: {
          days: 14,
          daily: [
            {
              metric_date: "2026-04-07",
              cost_per_story: 0.6,
            },
          ],
          retentionDaily: [
            {
              cohort_date: "2026-04-01",
              cohort_size: 10,
              d1_retained_users: 2,
              d7_retained_users: 1,
              d1_retention_rate: 0.2,
              d7_retention_rate: 0.1,
            },
          ],
          userRetention: {
            user_id: "user-1",
            cohort_date: "2026-04-01",
            retained_d1: true,
            retained_d7: false,
            cohort_age_days: 6,
          },
        },
        diagnostics: {
          degraded: true,
          reasons: ["rpc_error"],
        },
      })),
      resolveKpiWarningMessage: vi.fn(() => "kpi warning"),
    });

    expect(result.paymentHistory).toHaveLength(5);
    expect(result.paymentHistory[0]).toEqual({
      id: "p1",
      bead_quantity: 2,
      amount: 1000,
      created_at: "2026-04-01T00:00:00.000Z",
      status: "completed",
    });
    expect(result.kpiDaily).toHaveLength(1);
    expect(result.kpiRetentionDaily).toHaveLength(1);
    expect(result.kpiUserRetention?.retained_d1).toBe(true);
    expect(result.kpiWarningMessage).toBe("kpi warning");
  });

  it("falls back to empty kpi snapshot when kpi loading fails", async () => {
    const result = await loadProfilePageData({
      getProfileSummary: vi.fn(async () => ({
        profile: null,
        stats: null,
        recentStories: [],
      })),
      getPaymentHistory: vi.fn(async () => []),
      getKpi: vi.fn(async () => {
        throw new Error("kpi failed");
      }),
      resolveKpiWarningMessage: vi.fn(() => null),
    });

    expect(result.kpiDaily).toEqual([]);
    expect(result.kpiRetentionDaily).toEqual([]);
    expect(result.kpiUserRetention).toBeNull();
    expect(result.kpiWarningMessage).toBe(PROFILE_KPI_LOAD_ERROR_MESSAGE);
  });

  it("propagates summary/payment loading failures", async () => {
    await expect(
      loadProfilePageData({
        getProfileSummary: vi.fn(async () => {
          throw new Error("summary failed");
        }),
        getPaymentHistory: vi.fn(async () => []),
        getKpi: vi.fn(async () => ({
          data: {
            days: 14,
            daily: [],
            retentionDaily: [],
            userRetention: null,
          },
          diagnostics: {
            degraded: false,
            reasons: [],
          },
        })),
        resolveKpiWarningMessage: vi.fn(() => null),
      }),
    ).rejects.toThrow("summary failed");
  });
});
