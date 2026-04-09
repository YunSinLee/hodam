import { describe, expect, it } from "vitest";

import { getPaymentStatusMeta } from "@/lib/ui/profile-payment-status";

describe("getPaymentStatusMeta", () => {
  it("maps completed status", () => {
    expect(getPaymentStatusMeta("completed")).toEqual({
      badgeClass: "bg-green-100 text-green-600",
      label: "완료",
    });
  });

  it("maps pending status", () => {
    expect(getPaymentStatusMeta("pending")).toEqual({
      badgeClass: "bg-yellow-100 text-yellow-600",
      label: "대기",
    });
  });

  it("falls back to failure status", () => {
    expect(getPaymentStatusMeta("failed")).toEqual({
      badgeClass: "bg-red-100 text-red-600",
      label: "실패",
    });
  });
});
