import { getWebhookRetryTotal } from "@/app/components/payment-history/payment-timeline-utils";
import PaymentTimelineContent from "@/app/components/payment-history/PaymentTimelineContent";
import PaymentTimelineStatusBadges from "@/app/components/payment-history/PaymentTimelineStatusBadges";
import type {
  PaymentHistoryFormatters,
  PaymentTimelinePanelHandlers,
  PaymentTimelinePanelState,
} from "@/app/payment-history/payment-history-contract";
import { getPaymentStatusText } from "@/lib/ui/payment-history";

interface PaymentHistoryTimelinePanelProps {
  state: PaymentTimelinePanelState;
  handlers: PaymentTimelinePanelHandlers;
  formatters: Pick<PaymentHistoryFormatters, "formatDate">;
}

export default function PaymentHistoryTimelinePanel({
  state,
  handlers,
  formatters,
}: PaymentHistoryTimelinePanelProps) {
  const {
    isOpen,
    isLoading,
    orderId,
    paymentFlowId,
    status,
    events,
    errorMessage,
  } = state;
  const { onClose } = handlers;
  const webhookEvents = events.filter(
    event => event.type === "webhook_received",
  );
  const webhookRetryTotal = getWebhookRetryTotal(webhookEvents);
  const hasMissingWebhookWarning =
    !isLoading && status === "completed" && webhookEvents.length === 0;
  const hasWebhookRetryWarning = !isLoading && webhookRetryTotal > 0;

  if (!isOpen) {
    return null;
  }

  return (
    <section
      aria-label="결제 처리 타임라인 패널"
      className="mt-4 rounded-2xl border border-rose-100 bg-white p-4 shadow-lg sm:mt-6 sm:p-6"
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 sm:text-xl">
            결제 처리 타임라인
          </h2>
          <p className="mt-1 break-all text-xs text-gray-500 sm:text-sm">
            주문번호: {orderId || "확인 중"}
          </p>
          {paymentFlowId && (
            <p className="mt-1 break-all text-xs text-gray-500 sm:text-sm">
              흐름ID: {paymentFlowId}
            </p>
          )}
          {status && (
            <p className="mt-1 text-xs font-medium text-gray-600 sm:text-sm">
              현재 상태: {getPaymentStatusText(status)}
            </p>
          )}
          {!isLoading && events.length > 0 && (
            <PaymentTimelineStatusBadges
              webhookEventCount={webhookEvents.length}
              webhookRetryTotal={webhookRetryTotal}
              eventCount={events.length}
              hasMissingWebhookWarning={hasMissingWebhookWarning}
              hasWebhookRetryWarning={hasWebhookRetryWarning}
            />
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="결제 타임라인 닫기"
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 sm:text-sm"
        >
          닫기
        </button>
      </header>

      <PaymentTimelineContent
        state={{
          isLoading,
          orderId,
          paymentFlowId,
          events,
          errorMessage,
        }}
        handlers={handlers}
        formatters={formatters}
      />
    </section>
  );
}
