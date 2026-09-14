import type {
  PaymentHistoryFilterHandlers,
  PaymentHistoryFilterState,
} from "@/app/payment-history/payment-history-contract";
import { PAYMENT_HISTORY_FILTER_OPTIONS } from "@/lib/ui/payment-history";

interface PaymentHistoryFilterBarProps {
  state: PaymentHistoryFilterState;
  handlers: PaymentHistoryFilterHandlers;
}

export default function PaymentHistoryFilterBar({
  state,
  handlers,
}: PaymentHistoryFilterBarProps) {
  const { filter } = state;
  const { onFilterChange } = handlers;

  return (
    <section className="rounded-xl bg-white p-4 shadow-lg sm:p-6">
      <div className="-mx-1 overflow-x-auto px-1">
        <div className="flex min-w-max gap-2">
          {PAYMENT_HISTORY_FILTER_OPTIONS.map(({ key, label }) => (
            <button
              type="button"
              key={key}
              onClick={() => onFilterChange(key)}
              aria-pressed={filter === key}
              className={`min-h-10 shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                filter === key
                  ? "bg-purple-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
