import type { StorySelectionSectionState } from "@/app/components/story/story-selection-contract";

export function shouldRenderSelectionBlock(
  state: StorySelectionSectionState,
): boolean {
  return state.selections.length > 0 || state.isSelectionLoading;
}
