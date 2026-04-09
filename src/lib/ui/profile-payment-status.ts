export interface PaymentStatusMeta {
  badgeClass: string;
  label: string;
}

export function getPaymentStatusMeta(status: string): PaymentStatusMeta {
  if (status === "completed") {
    return {
      badgeClass: "bg-green-100 text-green-600",
      label: "완료",
    };
  }

  if (status === "pending") {
    return {
      badgeClass: "bg-yellow-100 text-yellow-600",
      label: "대기",
    };
  }

  return {
    badgeClass: "bg-red-100 text-red-600",
    label: "실패",
  };
}
