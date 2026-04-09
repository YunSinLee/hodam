import type {
  PaymentHistoryFormatters,
  PaymentHistoryListHandlers,
} from "@/app/payment-history/payment-history-contract";
import type { PaymentHistory } from "@/lib/client/api/payment";
import {
  getPaymentStatusColor,
  getPaymentStatusText,
} from "@/lib/ui/payment-history";

interface PaymentHistoryListItemProps {
  payment: PaymentHistory;
  selectedOrderId: string | null;
  timelineLoadingOrderId: string | null;
  handlers: Pick<PaymentHistoryListHandlers, "onOpenTimeline">;
  formatters: PaymentHistoryFormatters;
}

function resolveUnitPrice(amount: number, beadQuantity: number): number | null {
  if (!Number.isFinite(amount) || !Number.isFinite(beadQuantity)) {
    return null;
  }

  if (beadQuantity <= 0) {
    return null;
  }

  return Math.round(amount / beadQuantity);
}

function resolveTimelineButtonText({
  isTimelineLoading,
  isTimelineOpen,
}: {
  isTimelineLoading: boolean;
  isTimelineOpen: boolean;
}) {
  if (isTimelineLoading) {
    return "불러오는 중...";
  }
  if (isTimelineOpen) {
    return "타임라인 확인 중";
  }
  return "상세 타임라인";
}

export default function PaymentHistoryListItem({
  payment,
  selectedOrderId,
  timelineLoadingOrderId,
  handlers,
  formatters,
}: PaymentHistoryListItemProps) {
  const { onOpenTimeline } = handlers;
  const { formatDate, formatCurrency } = formatters;
  const isTimelineLoading = timelineLoadingOrderId === payment.order_id;
  const isTimelineOpen = selectedOrderId === payment.order_id;
  const timelineButtonText = resolveTimelineButtonText({
    isTimelineLoading,
    isTimelineOpen,
  });
  const unitPrice = resolveUnitPrice(payment.amount, payment.bead_quantity);

  return (
    <article className="p-4 transition-colors hover:bg-gray-50 sm:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="mr-3 text-lg font-semibold text-gray-800">
              곶감 {payment.bead_quantity}개
            </h3>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${getPaymentStatusColor(
                payment.status,
              )}`}
            >
              {getPaymentStatusText(payment.status)}
            </span>
          </div>
          <div className="space-y-1 text-sm text-gray-600">
            <p className="break-all">주문번호: {payment.order_id}</p>
            {payment.payment_key && (
              <p className="break-all">결제키: {payment.payment_key}</p>
            )}
            {payment.payment_flow_id && (
              <p className="break-all">흐름ID: {payment.payment_flow_id}</p>
            )}
            <p>결제일: {formatDate(payment.created_at)}</p>
            {payment.completed_at && (
              <p>완료일: {formatDate(payment.completed_at)}</p>
            )}
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 md:items-end">
          <div className="text-2xl font-bold text-gray-800">
            {formatCurrency(payment.amount)}원
          </div>
          <div className="text-sm text-gray-600">
            {unitPrice === null
              ? "개당 정보 없음"
              : `개당 ${formatCurrency(unitPrice)}원`}
          </div>
          <button
            type="button"
            onClick={() =>
              onOpenTimeline(payment.order_id, payment.payment_flow_id)
            }
            disabled={isTimelineLoading}
            aria-label={`결제 ${payment.order_id} 타임라인 보기`}
            className="w-full rounded-lg border border-purple-200 px-3 py-2 text-xs font-semibold text-purple-700 transition-colors hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {timelineButtonText}
          </button>
        </div>
      </div>
    </article>
  );
}
