import PaymentHistoryErrorBanner from "@/app/components/payment-history/PaymentHistoryErrorBanner";
import PaymentHistoryFilterBar from "@/app/components/payment-history/PaymentHistoryFilterBar";
import PaymentHistoryHeader from "@/app/components/payment-history/PaymentHistoryHeader";
import PaymentHistoryStats from "@/app/components/payment-history/PaymentHistoryStats";
import type {
  PaymentHistoryErrorHandlers,
  PaymentHistoryErrorState,
  PaymentHistoryFilterHandlers,
  PaymentHistoryFilterState,
  PaymentHistoryFormatters,
  PaymentHistoryPageHandlers,
  PaymentHistoryStatsState,
} from "@/app/payment-history/payment-history-contract";

interface PaymentHistoryOverviewSectionProps {
  pageHandlers: PaymentHistoryPageHandlers;
  statsState: PaymentHistoryStatsState;
  filterState: PaymentHistoryFilterState;
  filterHandlers: PaymentHistoryFilterHandlers;
  errorState: PaymentHistoryErrorState | null;
  errorHandlers: PaymentHistoryErrorHandlers;
  formatters: PaymentHistoryFormatters;
}

export default function PaymentHistoryOverviewSection({
  pageHandlers,
  statsState,
  filterState,
  filterHandlers,
  errorState,
  errorHandlers,
  formatters,
}: PaymentHistoryOverviewSectionProps) {
  return (
    <section className="mb-6 space-y-4 sm:mb-8 sm:space-y-6">
      <PaymentHistoryHeader handlers={pageHandlers} />
      <PaymentHistoryStats state={statsState} formatters={formatters} />
      <PaymentHistoryFilterBar state={filterState} handlers={filterHandlers} />
      {errorState && (
        <PaymentHistoryErrorBanner
          state={errorState}
          handlers={errorHandlers}
        />
      )}
    </section>
  );
}
