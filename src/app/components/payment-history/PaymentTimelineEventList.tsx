import {
  createTimelineEventKey,
  getTimelineEventDetailText,
  getTimelineEventDotTone,
  getTimelineEventTitle,
} from "@/app/components/payment-history/payment-timeline-utils";
import type { PaymentHistoryFormatters } from "@/app/payment-history/payment-history-contract";

interface PaymentTimelineEventListProps {
  events: Array<{
    type:
      | "payment_created"
      | "payment_completed"
      | "payment_failed"
      | "payment_cancelled"
      | "webhook_received";
    source: "payment_history" | "webhook_transmissions";
    timestamp: string;
    details?: Record<string, unknown>;
  }>;
  formatDate: Pick<PaymentHistoryFormatters, "formatDate">["formatDate"];
}

export default function PaymentTimelineEventList({
  events,
  formatDate,
}: PaymentTimelineEventListProps) {
  return (
    <ol className="space-y-3">
      {events.map(event => {
        const detailText = getTimelineEventDetailText(event);
        return (
          <li key={createTimelineEventKey(event)} className="relative pl-5">
            <span
              className={`absolute left-0 top-2 h-2.5 w-2.5 rounded-full ${getTimelineEventDotTone(
                event.type,
              )}`}
            />
            <article className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-3 sm:px-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-gray-800">
                  {getTimelineEventTitle(event.type)}
                </p>
                <p className="text-xs text-gray-500">
                  {formatDate(event.timestamp)}
                </p>
              </div>
              {detailText && (
                <p className="mt-1 break-all text-xs text-gray-600">
                  {detailText}
                </p>
              )}
              <p className="mt-1 text-[11px] uppercase tracking-wide text-gray-400">
                source: {event.source}
              </p>
            </article>
          </li>
        );
      })}
    </ol>
  );
}
