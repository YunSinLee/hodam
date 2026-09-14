import type { ChangeEvent } from "react";

import type {
  StoryMessageViewModel,
  StorySelectionViewModel,
} from "@/app/service/story-page-state";
import type { StoryServiceFeedbackAction } from "@/lib/ui/story-service-error";

export interface StoryPageFeedback {
  type: "error" | "success";
  message: string;
  action?: StoryServiceFeedbackAction | null;
}

export interface StoryPageStatusState {
  hasHydrated: boolean;
  userId: string | undefined;
  pageFeedback: StoryPageFeedback | null;
  pageFeedbackAction: StoryServiceFeedbackAction | null;
}

export interface StorySessionState {
  isImageIncluded: boolean;
  images: string[];
  isImageLoading: boolean;
  isStoryLoading: boolean;
  isSelectionLoading: boolean;
  messages: StoryMessageViewModel[];
  isEnglishIncluded: boolean;
  isShowEnglish: boolean;
  translationInProgress: boolean;
  notice: string;
  selections: StorySelectionViewModel[];
  selectedChoice: string;
}

export interface StorySessionHandlers {
  onToggleEnglish: () => void;
  onTranslate: () => void;
  onSelectionClick: (selection: string) => void;
}

export interface StoryAuthenticatedState {
  neededBeadCount: number;
  keywords: string;
  isEnglishIncluded: boolean;
  isImageIncluded: boolean;
  isStoryLoading: boolean;
  isImageLoading: boolean;
  isStarted: boolean;
  session: StorySessionState;
}

export interface StoryAuthenticatedHandlers extends StorySessionHandlers {
  onKeywordsChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onStartStory: () => void;
  onEnglishIncludedChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onImageIncludedChange: (event: ChangeEvent<HTMLInputElement>) => void;
}
