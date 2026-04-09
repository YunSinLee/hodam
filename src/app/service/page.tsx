"use client";

import PageContainer from "@/app/components/common/PageContainer";
import GuideForSign from "@/app/components/GuideForSign";
import StoryAuthenticatedArea from "@/app/components/story/StoryAuthenticatedArea";
import StoryPageStatusArea from "@/app/components/story/StoryPageStatusArea";

import useStoryPageController from "./useStoryPageController";

export default function Hodam() {
  const { statusState, authenticatedState, handlers, onFeedbackAction } =
    useStoryPageController();

  return (
    <PageContainer width="sm" className="flex flex-col gap-4 py-4">
      <StoryPageStatusArea
        state={statusState}
        onFeedbackAction={onFeedbackAction}
      />

      {statusState.hasHydrated && statusState.userId && (
        <StoryAuthenticatedArea
          state={authenticatedState}
          handlers={handlers}
        />
      )}

      {statusState.hasHydrated && !statusState.userId && <GuideForSign />}
    </PageContainer>
  );
}
