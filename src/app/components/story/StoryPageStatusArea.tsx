import StoryFeedbackBanner from "@/app/components/story/StoryFeedbackBanner";
import StoryLoadingNotice from "@/app/components/story/StoryLoadingNotice";
import type { StoryPageStatusState } from "@/app/service/story-page-contract";
import type { StoryServiceFeedbackAction } from "@/lib/ui/story-service-error";

interface StoryPageStatusAreaProps {
  state: StoryPageStatusState;
  onFeedbackAction: (action: StoryServiceFeedbackAction) => void;
}

export default function StoryPageStatusArea({
  state,
  onFeedbackAction,
}: StoryPageStatusAreaProps) {
  const { hasHydrated, pageFeedback, pageFeedbackAction } = state;

  return (
    <>
      {pageFeedback && (
        <StoryFeedbackBanner
          type={pageFeedback.type}
          message={pageFeedback.message}
          actionLabel={pageFeedbackAction?.label}
          onAction={
            pageFeedbackAction
              ? () => onFeedbackAction(pageFeedbackAction)
              : undefined
          }
        />
      )}

      {!hasHydrated && (
        <StoryLoadingNotice title="로그인 상태를 확인하는 중입니다..." />
      )}
    </>
  );
}
