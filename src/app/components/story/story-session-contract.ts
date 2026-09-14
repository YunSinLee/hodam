import type { StoryMessage } from "@/app/components/message-display/message-display-contract";
import type { StorySelectionSectionState } from "@/app/components/story/story-selection-contract";
import type { StorySelectionViewModel } from "@/app/service/story-page-state";

export interface StoryMessageSectionState {
  messages: StoryMessage[];
  isEnglishIncluded: boolean;
  isShowEnglish: boolean;
  translationInProgress: boolean;
}

export interface StoryMessageSectionHandlers {
  onToggleEnglish: () => void;
  onTranslate: () => void;
}

export interface StorySessionPanelState {
  isImageIncluded: boolean;
  images: string[];
  isImageLoading: boolean;
  isStoryLoading: boolean;
  isSelectionLoading: boolean;
  messages: StoryMessage[];
  isEnglishIncluded: boolean;
  isShowEnglish: boolean;
  translationInProgress: boolean;
  notice: string;
  selections: StorySelectionViewModel[];
  selectedChoice: string;
}

export interface StorySessionPanelHandlers extends StoryMessageSectionHandlers {
  onSelectionClick: (selection: string) => void;
}

export interface StoryImagePanelState {
  images: string[];
  isImageLoading: boolean;
  isSelectionLoading: boolean;
}

export function toStoryImagePanelState(
  state: StorySessionPanelState,
): StoryImagePanelState {
  return {
    images: state.images,
    isImageLoading: state.isImageLoading,
    isSelectionLoading: state.isSelectionLoading,
  };
}

export function toStorySelectionSectionState(
  state: StorySessionPanelState,
): StorySelectionSectionState {
  return {
    notice: state.notice,
    selections: state.selections,
    isShowEnglish: state.isShowEnglish,
    selectedChoice: state.selectedChoice,
    isSelectionLoading: state.isSelectionLoading,
  };
}
