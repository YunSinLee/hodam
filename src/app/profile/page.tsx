"use client";

import PageContainer from "@/app/components/common/PageContainer";
import ProfileActivityPanel from "@/app/components/profile/ProfileActivityPanel";
import ProfileConfirmModal from "@/app/components/profile/ProfileConfirmModal";
import ProfileFeedbackBanner from "@/app/components/profile/ProfileFeedbackBanner";
import ProfileImageOptionsModal from "@/app/components/profile/ProfileImageOptionsModal";
import ProfileLoadingState from "@/app/components/profile/ProfileLoadingState";
import ProfileNotFoundState from "@/app/components/profile/ProfileNotFoundState";
import ProfilePageHeader from "@/app/components/profile/ProfilePageHeader";
import ProfileSidebar from "@/app/components/profile/ProfileSidebar";
import useProfilePageController from "@/app/profile/useProfilePageController";

export default function ProfilePage() {
  const {
    pageState,
    pageHandlers,
    sidebarState,
    sidebarHandlers,
    activityState,
    activityHandlers,
    modalState,
    modalHandlers,
    formatters,
  } = useProfilePageController();

  if (pageState.isLoading || !pageState.isAuthReady) {
    return <ProfileLoadingState />;
  }

  if (!pageState.profile) {
    return <ProfileNotFoundState onGoHome={pageHandlers.onGoHome} />;
  }
  if (!sidebarState) {
    return <ProfileLoadingState />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50">
      <PageContainer width="xl" className="py-6 sm:py-8">
        <ProfilePageHeader />

        {pageState.pageFeedback && (
          <ProfileFeedbackBanner
            type={pageState.pageFeedback.type}
            message={pageState.pageFeedback.message}
            actionLabel={pageState.pageFeedback.actionLabel}
            onAction={pageHandlers.onPageFeedbackAction}
          />
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
          <ProfileSidebar
            state={sidebarState}
            handlers={sidebarHandlers}
            formatters={formatters}
          />

          <ProfileActivityPanel
            state={activityState}
            handlers={activityHandlers}
            formatters={formatters}
          />
        </div>
      </PageContainer>

      {modalState.showImageOptions && (
        <ProfileImageOptionsModal
          isUploadingImage={modalState.isUploadingImage}
          hasCustomProfileImage={modalState.hasCustomProfileImage}
          onUpload={modalHandlers.onUploadImage}
          onRemove={modalHandlers.onRemoveImage}
          onClose={modalHandlers.onCloseImageOptions}
        />
      )}

      {modalState.confirmAction && (
        <ProfileConfirmModal
          action={modalState.confirmAction}
          onCancel={modalHandlers.onCancelConfirmAction}
          onConfirm={modalHandlers.onConfirmAction}
        />
      )}
    </div>
  );
}
