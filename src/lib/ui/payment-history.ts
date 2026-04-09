import type { PaymentHistory } from "@/lib/client/api/payment";

export type PaymentHistoryFilter =
  | "all"
  | "completed"
  | "pending"
  | "failed"
  | "cancelled";

export interface PaymentHistoryFilterOption {
  key: PaymentHistoryFilter;
  label: string;
}

export const PAYMENT_HISTORY_FILTER_OPTIONS: PaymentHistoryFilterOption[] = [
  { key: "all", label: "전체" },
  { key: "completed", label: "완료" },
  { key: "pending", label: "대기중" },
  { key: "failed", label: "실패" },
  { key: "cancelled", label: "취소됨" },
];

interface SearchParamsLike {
  get: (key: string) => string | null;
}

export interface PaymentHistoryTimelineQuery {
  orderId?: string;
  paymentFlowId?: string;
}

function normalizeQueryValue(value: string | null): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function parsePaymentHistoryTimelineQuery(
  searchParams: SearchParamsLike,
): PaymentHistoryTimelineQuery | null {
  const orderId = normalizeQueryValue(searchParams.get("orderId"));
  const paymentFlowId =
    normalizeQueryValue(searchParams.get("flowId")) ||
    normalizeQueryValue(searchParams.get("paymentFlowId"));
  if (!orderId && !paymentFlowId) return null;

  return {
    orderId: orderId || undefined,
    paymentFlowId: paymentFlowId || undefined,
  };
}

export function getPaymentStatusText(status: string): string {
  switch (status) {
    case "completed":
      return "완료";
    case "pending":
      return "대기중";
    case "failed":
      return "실패";
    case "cancelled":
      return "취소됨";
    default:
      return status;
  }
}

export function getPaymentStatusColor(status: string): string {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-700";
    case "pending":
      return "bg-yellow-100 text-yellow-700";
    case "failed":
      return "bg-red-100 text-red-700";
    case "cancelled":
      return "bg-gray-100 text-gray-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export function filterPaymentHistory(
  payments: PaymentHistory[],
  filter: PaymentHistoryFilter,
): PaymentHistory[] {
  if (filter === "all") return payments;
  return payments.filter(payment => payment.status === filter);
}

export function getCompletedPaymentTotals(payments: PaymentHistory[]): {
  totalAmount: number;
  totalBeads: number;
} {
  return payments
    .filter(payment => payment.status === "completed")
    .reduce(
      (acc, payment) => ({
        totalAmount: acc.totalAmount + payment.amount,
        totalBeads: acc.totalBeads + payment.bead_quantity,
      }),
      { totalAmount: 0, totalBeads: 0 },
    );
}
