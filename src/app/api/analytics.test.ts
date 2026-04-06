import { beforeEach, describe, expect, it, vi } from "vitest";

import analyticsApi from "@/lib/client/api/analytics";

const { authorizedFetchWithMetaMock } = vi.hoisted(() => ({
  authorizedFetchWithMetaMock: vi.fn(),
}));

vi.mock("@/lib/client/api/http", () => ({
  authorizedFetchWithMeta: authorizedFetchWithMetaMock,
}));

describe("analyticsApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads KPI metrics and diagnostics", async () => {
    authorizedFetchWithMetaMock.mockResolvedValue({
      data: {
        days: 14,
        daily: [],
        retentionDaily: [],
        userRetention: null,
      },
      headers: new Headers({
        "x-hodam-kpi-degraded": "1",
        "x-hodam-kpi-degraded-reasons":
          "kpi_daily_error,kpi_user_retention_error",
      }),
    });

    const result = await analyticsApi.getKpi(14);

    expect(authorizedFetchWithMetaMock).toHaveBeenCalledWith(
      "/api/v1/analytics/kpi?days=14",
      { method: "GET" },
      expect.any(Object),
    );
    expect(result.data.days).toBe(14);
    expect(result.diagnostics).toEqual({
      degraded: true,
      reasons: ["kpi_daily_error", "kpi_user_retention_error"],
    });
  });

  it("clamps invalid days to default", async () => {
    authorizedFetchWithMetaMock.mockResolvedValue({
      data: {
        days: 14,
        daily: [],
        retentionDaily: [],
        userRetention: null,
      },
      headers: new Headers(),
    });

    await analyticsApi.getKpi(-1);
    expect(authorizedFetchWithMetaMock).toHaveBeenCalledWith(
      "/api/v1/analytics/kpi?days=14",
      { method: "GET" },
      expect.any(Object),
    );
  });

  it("caps requested days at 90", async () => {
    authorizedFetchWithMetaMock.mockResolvedValue({
      data: {
        days: 90,
        daily: [],
        retentionDaily: [],
        userRetention: null,
      },
      headers: new Headers(),
    });

    await analyticsApi.getKpi(999);
    expect(authorizedFetchWithMetaMock).toHaveBeenCalledWith(
      "/api/v1/analytics/kpi?days=90",
      { method: "GET" },
      expect.any(Object),
    );
  });
});
