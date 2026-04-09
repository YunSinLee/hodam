import SelectionDisplay from "@/app/components/SelectionDisplay";
import type {
  StorySelectionSectionHandlers,
  StorySelectionSectionState,
} from "@/app/components/story/story-selection-contract";
import { shouldRenderSelectionBlock } from "@/app/components/story/story-selection-view";

interface StorySelectionSectionProps {
  state: StorySelectionSectionState;
  handlers: StorySelectionSectionHandlers;
}

export default function StorySelectionSection({
  state,
  handlers,
}: StorySelectionSectionProps) {
  const {
    notice,
    selections,
    isShowEnglish,
    selectedChoice,
    isSelectionLoading,
  } = state;
  const showSelectionBlock = shouldRenderSelectionBlock(state);

  if (!notice && !showSelectionBlock) {
    return null;
  }

  return (
    <section className="mb-4 space-y-2">
      {notice && (
        <p className="text-sm text-orange-600 sm:text-base">{notice}</p>
      )}

      {showSelectionBlock && (
        <>
          <h2 className="text-lg font-semibold text-gray-800 sm:text-xl">
            다음 전개를 선택하세요
          </h2>
          <SelectionDisplay
            selections={selections}
            isShowEnglish={isShowEnglish}
            onSelectionClick={handlers.onSelectionClick}
            selectedChoice={selectedChoice}
            isSelectionLoading={isSelectionLoading}
          />
        </>
      )}
    </section>
  );
}
