"use client";

import { Suspense } from "react";

import PageContainer from "@/app/components/common/PageContainer";
import PaymentHistoryList from "@/app/components/payment-history/PaymentHistoryList";
import PaymentHistoryLoadingState from "@/app/components/payment-history/PaymentHistoryLoadingState";
import PaymentHistoryOverviewSection from "@/app/components/payment-history/PaymentHistoryOverviewSection";
import PaymentHistoryTimelinePanel from "@/app/components/payment-history/PaymentHistoryTimelinePanel";
import usePaymentHistoryPageController from "@/app/payment-history/usePaymentHistoryPageController";

function PaymentHistoryPageContent() {
  const {
    pageState,
    pageHandlers,
    errorState,
    errorHandlers,
    filterState,
    filterHandlers,
    statsState,
    listState,
    listHandlers,
    timelinePanelState,
    timelinePanelHandlers,
    formatters,
  } = usePaymentHistoryPageController();

  if (pageState.isLoading || !pageState.isAuthReady) {
    return <PaymentHistoryLoadingState />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50">
      <PageContainer width="xl" className="py-6 sm:py-8">
        <PaymentHistoryOverviewSection
          pageHandlers={pageHandlers}
          statsState={statsState}
          filterState={filterState}
          filterHandlers={filterHandlers}
          errorState={errorState}
          errorHandlers={errorHandlers}
          formatters={formatters}
        />

        <div className="overflow-hidden rounded-xl bg-white shadow-lg">
          <PaymentHistoryList
            state={listState}
            handlers={listHandlers}
            formatters={formatters}
          />
        </div>

        <PaymentHistoryTimelinePanel
          state={timelinePanelState}
          handlers={timelinePanelHandlers}
          formatters={formatters}
        />
      </PageContainer>
    </div>
  );
}

export default function PaymentHistoryPage() {
  return (
    <Suspense fallback={<PaymentHistoryLoadingState />}>
      <PaymentHistoryPageContent />
    </Suspense>
  );
}
