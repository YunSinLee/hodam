import MessageDisplay from "@/app/components/MessageDisplay";
import type {
  StoryMessageSectionHandlers,
  StoryMessageSectionState,
} from "@/app/components/story/story-session-contract";
import StoryMessageSectionActionButton from "@/app/components/story/StoryMessageSectionActionButton";

interface StoryMessageSectionProps {
  state: StoryMessageSectionState;
  handlers: StoryMessageSectionHandlers;
}

export default function StoryMessageSection({
  state,
  handlers,
}: StoryMessageSectionProps) {
  const { messages, isEnglishIncluded, isShowEnglish, translationInProgress } =
    state;

  if (messages.length === 0) {
    return null;
  }

  return (
    <section className="mb-4 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-gray-800 sm:text-xl">
          동화 내용
        </h2>

        <StoryMessageSectionActionButton
          isEnglishIncluded={isEnglishIncluded}
          isShowEnglish={isShowEnglish}
          translationInProgress={translationInProgress}
          onToggleEnglish={handlers.onToggleEnglish}
          onTranslate={handlers.onTranslate}
        />
      </div>

      <MessageDisplay
        messages={messages}
        isShowEnglish={isShowEnglish}
        useGoogleTTS
      />
    </section>
  );
}
