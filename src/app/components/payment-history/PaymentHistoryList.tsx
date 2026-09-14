import PaymentHistoryEmptyState from "@/app/components/payment-history/PaymentHistoryEmptyState";
import PaymentHistoryListItem from "@/app/components/payment-history/PaymentHistoryListItem";
import type {
  PaymentHistoryFormatters,
  PaymentHistoryListHandlers,
  PaymentHistoryListState,
} from "@/app/payment-history/payment-history-contract";

interface PaymentHistoryListProps {
  state: PaymentHistoryListState;
  handlers: PaymentHistoryListHandlers;
  formatters: PaymentHistoryFormatters;
}

export default function PaymentHistoryList({
  state,
  handlers,
  formatters,
}: PaymentHistoryListProps) {
  const { payments, filter, selectedOrderId, timelineLoadingOrderId } = state;
  const { onGoBead, onOpenTimeline } = handlers;
  const { formatDate, formatCurrency } = formatters;

  if (payments.length === 0) {
    return <PaymentHistoryEmptyState filter={filter} onGoBead={onGoBead} />;
  }

  return (
    <div className="divide-y divide-gray-100">
      {payments.map(payment => (
        <PaymentHistoryListItem
          key={payment.id}
          payment={payment}
          selectedOrderId={selectedOrderId}
          timelineLoadingOrderId={timelineLoadingOrderId}
          handlers={{
            onOpenTimeline,
          }}
          formatters={{
            formatDate,
            formatCurrency,
          }}
        />
      ))}
    </div>
  );
}
