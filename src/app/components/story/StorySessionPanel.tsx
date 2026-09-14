import type {
  StorySessionPanelHandlers,
  StorySessionPanelState,
} from "@/app/components/story/story-session-contract";
import {
  toStoryImagePanelState,
  toStorySelectionSectionState,
} from "@/app/components/story/story-session-contract";
import {
  shouldShowImagePanel,
  shouldShowInitialStoryLoading,
  shouldShowSelectionStoryLoading,
} from "@/app/components/story/story-session-view";
import StoryImagePanel from "@/app/components/story/StoryImagePanel";
import StoryLoadingNotice from "@/app/components/story/StoryLoadingNotice";
import StoryMessageSection from "@/app/components/story/StoryMessageSection";
import StorySelectionSection from "@/app/components/story/StorySelectionSection";

interface StorySessionPanelProps {
  state: StorySessionPanelState;
  handlers: StorySessionPanelHandlers;
}

export default function StorySessionPanel({
  state,
  handlers,
}: StorySessionPanelProps) {
  const { messages, isEnglishIncluded, isShowEnglish, translationInProgress } =
    state;

  return (
    <section className="space-y-4 rounded-2xl bg-white/80 p-2 sm:p-3">
      {shouldShowImagePanel(state) && (
        <StoryImagePanel state={toStoryImagePanelState(state)} />
      )}

      {shouldShowInitialStoryLoading(state) && (
        <StoryLoadingNotice title="첫 번째 동화를 생성하고 있습니다..." />
      )}

      <StoryMessageSection
        state={{
          messages,
          isEnglishIncluded,
          isShowEnglish,
          translationInProgress,
        }}
        handlers={{
          onToggleEnglish: handlers.onToggleEnglish,
          onTranslate: handlers.onTranslate,
        }}
      />

      {shouldShowSelectionStoryLoading(state) && (
        <StoryLoadingNotice
          title="새로운 이야기를 생성하고 있습니다..."
          description="선택하신 내용을 바탕으로 동화를 이어가고 있어요."
        />
      )}

      <StorySelectionSection
        state={toStorySelectionSectionState(state)}
        handlers={{
          onSelectionClick: handlers.onSelectionClick,
        }}
      />
    </section>
  );
}
