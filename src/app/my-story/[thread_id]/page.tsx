"use client";

import MyStoryDetailContent from "@/app/components/my-story-detail/MyStoryDetailContent";
import MyStoryDetailDiagnosticsBanner from "@/app/components/my-story-detail/MyStoryDetailDiagnosticsBanner";
import MyStoryDetailHeader from "@/app/components/my-story-detail/MyStoryDetailHeader";

import useMyStoryDetailController from "./useMyStoryDetailController";

export default function MyStoryDetail() {
  const { statusState, pageState, handlers } = useMyStoryDetailController();

  return (
    <div
      className={`min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 transition-opacity duration-500 ${
        statusState.isPageLoaded ? "opacity-100" : "opacity-0"
      }`}
    >
      <MyStoryDetailHeader
        threadId={pageState.threadId}
        ableEnglish={pageState.ableEnglish}
        isShowEnglish={pageState.isShowEnglish}
        onToggleEnglish={handlers.onToggleEnglish}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {pageState.diagnostics?.degraded && (
          <MyStoryDetailDiagnosticsBanner diagnostics={pageState.diagnostics} />
        )}
        {pageState.errorMessage && pageState.messages.length > 0 && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {pageState.errorMessage}
          </div>
        )}

        <MyStoryDetailContent
          isLoading={statusState.isLoading}
          imageUrl={pageState.imageUrl}
          messages={pageState.messages}
          ableEnglish={pageState.ableEnglish}
          isShowEnglish={pageState.isShowEnglish}
          errorMessage={pageState.errorMessage}
          onRetry={handlers.onRetry}
        />
      </div>
    </div>
  );
}
