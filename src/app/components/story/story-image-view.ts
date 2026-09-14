import type { StoryImagePanelState } from "@/app/components/story/story-session-contract";

export function shouldRenderStoryImageLoading(
  state: StoryImagePanelState,
): boolean {
  return state.isImageLoading && !state.isSelectionLoading;
}

export function shouldRenderStoryImagePanel(
  state: StoryImagePanelState,
): boolean {
  return state.images.length > 0 || shouldRenderStoryImageLoading(state);
}

export function getStoryImageAltText(index: number): string {
  return `동화 이미지 ${index + 1}`;
}
