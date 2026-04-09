import type { StorySessionPanelState } from "@/app/components/story/story-session-contract";

export function shouldShowImagePanel(state: StorySessionPanelState): boolean {
  return state.isImageIncluded;
}

export function shouldShowInitialStoryLoading(
  state: StorySessionPanelState,
): boolean {
  return state.isStoryLoading && !state.isSelectionLoading;
}

export function shouldShowSelectionStoryLoading(
  state: StorySessionPanelState,
): boolean {
  return state.isSelectionLoading && state.isStoryLoading;
}
