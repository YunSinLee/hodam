import PaymentTimelineEventList from "@/app/components/payment-history/PaymentTimelineEventList";
import type {
  PaymentHistoryFormatters,
  PaymentTimelinePanelHandlers,
  PaymentTimelinePanelState,
} from "@/app/payment-history/payment-history-contract";

interface PaymentTimelineContentProps {
  state: Pick<
    PaymentTimelinePanelState,
    "isLoading" | "orderId" | "paymentFlowId" | "events" | "errorMessage"
  >;
  handlers: Pick<PaymentTimelinePanelHandlers, "onRetry">;
  formatters: Pick<PaymentHistoryFormatters, "formatDate">;
}

export default function PaymentTimelineContent({
  state,
  handlers,
  formatters,
}: PaymentTimelineContentProps) {
  const { isLoading, orderId, paymentFlowId, events, errorMessage } = state;
  const { onRetry } = handlers;
  const { formatDate } = formatters;

  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500"
      >
        {orderId
          ? "결제 타임라인을 불러오는 중..."
          : "결제 흐름으로 주문 타임라인을 조회하는 중..."}
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-100 bg-red-50 px-4 py-4"
      >
        <p className="text-sm font-medium text-red-700">{errorMessage}</p>
        {!orderId && paymentFlowId && (
          <p className="mt-2 break-all text-xs text-red-600">
            흐름ID 기준 조회 실패: {paymentFlowId}
          </p>
        )}
        <button
          type="button"
          onClick={onRetry}
          aria-label="결제 타임라인 다시 시도"
          className="mt-3 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500"
      >
        표시할 타임라인 이벤트가 없습니다.
      </div>
    );
  }

  return <PaymentTimelineEventList events={events} formatDate={formatDate} />;
}
