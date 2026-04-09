import FeedbackBanner from "@/app/components/common/FeedbackBanner";
import type {
  PaymentHistoryErrorHandlers,
  PaymentHistoryErrorState,
} from "@/app/payment-history/payment-history-contract";

interface PaymentHistoryErrorBannerProps {
  state: PaymentHistoryErrorState;
  handlers: PaymentHistoryErrorHandlers;
}

export default function PaymentHistoryErrorBanner({
  state,
  handlers,
}: PaymentHistoryErrorBannerProps) {
  const { message, actionLabel } = state;
  const { onAction } = handlers;

  return (
    <FeedbackBanner
      tone="error"
      message={message}
      actionLabel={actionLabel}
      onAction={onAction}
    />
  );
}
