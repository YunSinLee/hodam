import KeywordInput from "@/app/components/KeywordInput";
import type {
  StorySessionPanelHandlers,
  StorySessionPanelState,
} from "@/app/components/story/story-session-contract";
import StoryLoadingNotice from "@/app/components/story/StoryLoadingNotice";
import StorySessionPanel from "@/app/components/story/StorySessionPanel";
import type {
  StoryAuthenticatedHandlers,
  StoryAuthenticatedState,
} from "@/app/service/story-page-contract";

interface StoryAuthenticatedAreaProps {
  state: StoryAuthenticatedState;
  handlers: StoryAuthenticatedHandlers;
}

export default function StoryAuthenticatedArea({
  state,
  handlers,
}: StoryAuthenticatedAreaProps) {
  const {
    neededBeadCount,
    keywords,
    isEnglishIncluded,
    isImageIncluded,
    isStoryLoading,
    isImageLoading,
    isStarted,
    session,
  } = state;

  const sessionPanelState: StorySessionPanelState = {
    ...session,
    isImageIncluded,
    isImageLoading,
    isStoryLoading,
    isEnglishIncluded,
  };

  const sessionPanelHandlers: StorySessionPanelHandlers = {
    onToggleEnglish: handlers.onToggleEnglish,
    onTranslate: handlers.onTranslate,
    onSelectionClick: handlers.onSelectionClick,
  };

  return (
    <div className="flex flex-col gap-4">
      <KeywordInput
        neededBeadCount={neededBeadCount}
        keywords={keywords}
        isEnglishIncluded={isEnglishIncluded}
        isImageIncluded={isImageIncluded}
        onKeywordsChange={handlers.onKeywordsChange}
        onButtonClicked={handlers.onStartStory}
        onEnglishIncludedChange={handlers.onEnglishIncludedChange}
        onImageIncludedChange={handlers.onImageIncludedChange}
      />

      {isImageIncluded && isStoryLoading && !isStarted && (
        <StoryLoadingNotice tone="blue" title="이미지 생성 중..." />
      )}

      {isStarted && (
        <StorySessionPanel
          state={sessionPanelState}
          handlers={sessionPanelHandlers}
        />
      )}
    </div>
  );
}
