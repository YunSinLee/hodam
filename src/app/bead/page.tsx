"use client";

import { Suspense } from "react";

import useBeadPageController from "@/app/bead/useBeadPageController";
import BeadBalanceCard from "@/app/components/bead/BeadBalanceCard";
import BeadCenteredState from "@/app/components/bead/BeadCenteredState";
import BeadFeedbackBanner from "@/app/components/bead/BeadFeedbackBanner";
import BeadPackageCard from "@/app/components/bead/BeadPackageCard";
import BeadPageHeader from "@/app/components/bead/BeadPageHeader";
import BeadPaymentHistoryCard from "@/app/components/bead/BeadPaymentHistoryCard";
import BeadUsageGuide from "@/app/components/bead/BeadUsageGuide";
import BeadWarningBanner from "@/app/components/bead/BeadWarningBanner";
import PageContainer from "@/app/components/common/PageContainer";

function BeadPageContent() {
  const { statusState, pageState, handlers } = useBeadPageController();

  if (!statusState.hasHydrated) {
    return <BeadCenteredState loading message="로그인 상태를 확인하는 중..." />;
  }

  if (!statusState.userId) {
    return (
      <BeadCenteredState
        title="로그인이 필요합니다"
        message="곶감 충전을 위해 먼저 로그인해주세요."
      />
    );
  }

  return (
    <PageContainer width="md" className="py-6 sm:py-8">
      <BeadPageHeader />

      {pageState.pageFeedback && (
        <BeadFeedbackBanner
          type={pageState.pageFeedback.type}
          message={pageState.pageFeedback.message}
          actionLabel={pageState.pageFeedback.actionLabel}
          onAction={
            pageState.pageFeedback.actionLabel
              ? handlers.onFeedbackAction
              : undefined
          }
        />
      )}

      {!pageState.tossClientKey && (
        <BeadWarningBanner message="결제 클라이언트 키가 설정되지 않아 결제를 진행할 수 없습니다. `NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY` 환경변수를 확인해주세요." />
      )}

      <BeadBalanceCard count={pageState.beadCount} />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4 lg:gap-6">
        {pageState.packages.map(pkg => (
          <BeadPackageCard
            key={pkg.id}
            pkg={pkg}
            isLoading={pageState.isLoading}
            isSelected={pageState.selectedPackageId === pkg.id}
            onPurchase={handlers.onPurchase}
          />
        ))}
      </div>

      <BeadPaymentHistoryCard
        onOpenPaymentHistory={handlers.onOpenPaymentHistory}
      />
      <BeadUsageGuide />
    </PageContainer>
  );
}

export default function BeadPage() {
  return (
    <Suspense
      fallback={
        <BeadCenteredState loading message="결제 정보를 불러오는 중..." />
      }
    >
      <BeadPageContent />
    </Suspense>
  );
}
