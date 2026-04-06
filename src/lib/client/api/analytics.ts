import { KpiResponseSchema } from "@/app/api/v1/schemas";
import type { KpiResponse } from "@/app/api/v1/types";

import { authorizedFetchWithMeta } from "./http";

export interface KpiDiagnostics {
  degraded: boolean;
  reasons: string[];
}

export interface KpiResult {
  data: KpiResponse;
  diagnostics: KpiDiagnostics;
}

const analyticsApi = {
  async getKpi(days: number = 14): Promise<KpiResult> {
    const safeDays =
      Number.isFinite(days) && days > 0 ? Math.min(Math.floor(days), 90) : 14;

    const { data, headers } = await authorizedFetchWithMeta<KpiResponse>(
      `/api/v1/analytics/kpi?days=${safeDays}`,
      {
        method: "GET",
      },
      KpiResponseSchema,
    );

    const degraded = headers.get("x-hodam-kpi-degraded") === "1";
    const reasons = (headers.get("x-hodam-kpi-degraded-reasons") || "")
      .split(",")
      .map(item => item.trim())
      .filter(Boolean);

    return {
      data,
      diagnostics: {
        degraded,
        reasons,
      },
    };
  },
};

export default analyticsApi;
