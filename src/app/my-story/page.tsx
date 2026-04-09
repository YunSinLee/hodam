"use client";

import PageContainer from "@/app/components/common/PageContainer";
import MyStoryEmptyState from "@/app/components/my-story/MyStoryEmptyState";
import MyStoryHeader from "@/app/components/my-story/MyStoryHeader";
import MyStorySkeletonGrid from "@/app/components/my-story/MyStorySkeletonGrid";
import MyStoryStatusBanner from "@/app/components/my-story/MyStoryStatusBanner";
import MyStoryThreadGrid from "@/app/components/my-story/MyStoryThreadGrid";
import useMyStoryPageController from "@/app/my-story/useMyStoryPageController";

export default function MyStory() {
  const { pageState, bannerState, handlers } = useMyStoryPageController();
  const { isLoading, isAuthReady, isPageLoaded, threads } = pageState;
  let content = <MyStoryThreadGrid threads={threads} />;

  if (isLoading || !isAuthReady) {
    content = <MyStorySkeletonGrid />;
  } else if (threads.length === 0) {
    content = <MyStoryEmptyState />;
  }

  return (
    <PageContainer
      width="lg"
      className={`min-h-screen py-6 transition-opacity duration-500 sm:py-8 ${isPageLoaded ? "opacity-100" : "opacity-0"}`}
    >
      <MyStoryHeader />

      {bannerState.error && (
        <MyStoryStatusBanner
          tone="error"
          message={bannerState.error.message}
          actionLabel={bannerState.error.actionLabel}
          onAction={handlers.onErrorAction}
        />
      )}

      {bannerState.warningMessage && (
        <MyStoryStatusBanner
          tone="warning"
          message={bannerState.warningMessage}
        />
      )}

      {content}
    </PageContainer>
  );
}
