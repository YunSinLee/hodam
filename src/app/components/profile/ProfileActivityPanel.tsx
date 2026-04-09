import ProfileKpiPanel from "@/app/components/profile/ProfileKpiPanel";
import ProfileRecentPaymentsPanel from "@/app/components/profile/ProfileRecentPaymentsPanel";
import ProfileRecentStoriesPanel from "@/app/components/profile/ProfileRecentStoriesPanel";
import ProfileSummaryStats from "@/app/components/profile/ProfileSummaryStats";
import type {
  ProfileActivityHandlers,
  ProfileActivityState,
  ProfileFormatters,
} from "@/app/profile/profile-page-contract";

interface ProfileActivityPanelProps {
  state: ProfileActivityState;
  handlers: ProfileActivityHandlers;
  formatters: ProfileFormatters;
}

export default function ProfileActivityPanel({
  state,
  handlers,
  formatters,
}: ProfileActivityPanelProps) {
  const {
    stats,
    kpiWarningMessage,
    latestCostPerStory,
    latestAuthCallbackSuccess,
    latestAuthCallbackError,
    latestAuthCallbackSuccessGoogle,
    latestAuthCallbackSuccessKakao,
    latestAuthCallbackErrorGoogle,
    latestAuthCallbackErrorKakao,
    latestD1Retention,
    latestD7Retention,
    retainedD1,
    retainedD7,
    recentStories,
    paymentHistory,
  } = state;
  const {
    onGoMyStory,
    onOpenStoryDetail,
    onGoService,
    onGoPaymentHistory,
    onGoBead,
  } = handlers;
  const { formatDate, formatCurrency } = formatters;

  return (
    <section className="space-y-6 sm:space-y-8 lg:col-span-2">
      <ProfileSummaryStats stats={stats} formatCurrency={formatCurrency} />

      <ProfileKpiPanel
        kpiWarningMessage={kpiWarningMessage}
        latestCostPerStory={latestCostPerStory}
        latestAuthCallbackSuccess={latestAuthCallbackSuccess}
        latestAuthCallbackError={latestAuthCallbackError}
        latestAuthCallbackSuccessGoogle={latestAuthCallbackSuccessGoogle}
        latestAuthCallbackSuccessKakao={latestAuthCallbackSuccessKakao}
        latestAuthCallbackErrorGoogle={latestAuthCallbackErrorGoogle}
        latestAuthCallbackErrorKakao={latestAuthCallbackErrorKakao}
        latestD1Retention={latestD1Retention}
        latestD7Retention={latestD7Retention}
        retainedD1={retainedD1}
        retainedD7={retainedD7}
      />

      <ProfileRecentStoriesPanel
        recentStories={recentStories}
        formatDate={formatDate}
        onGoMyStory={onGoMyStory}
        onOpenStoryDetail={onOpenStoryDetail}
        onGoService={onGoService}
      />

      <ProfileRecentPaymentsPanel
        paymentHistory={paymentHistory}
        formatDate={formatDate}
        formatCurrency={formatCurrency}
        onGoPaymentHistory={onGoPaymentHistory}
        onGoBead={onGoBead}
      />
    </section>
  );
}
