export interface StartStoryPendingState {
  isStarted: true;
  isStoryLoading: true;
  isImageLoading: boolean;
}

export interface StartStoryFailureState {
  isStarted: false;
}

export interface StartStorySettledState {
  isStoryLoading: false;
  isImageLoading: false;
}

export interface ContinueStoryPendingState {
  isSelectionLoading: true;
  selectedChoice: string;
  isStoryLoading: true;
  selections: [];
}

export interface ContinueStorySettledState {
  isStoryLoading: false;
  isSelectionLoading: false;
  selectedChoice: "";
}

export interface TranslateStoryPendingState {
  translationInProgress: true;
}

export interface TranslateStorySettledState {
  translationInProgress: false;
}

export function toStartStoryPendingState(params: {
  includeImage: boolean;
}): StartStoryPendingState {
  return {
    isStarted: true,
    isStoryLoading: true,
    isImageLoading: Boolean(params.includeImage),
  };
}

export function toStartStoryFailureState(): StartStoryFailureState {
  return {
    isStarted: false,
  };
}

export function toStartStorySettledState(): StartStorySettledState {
  return {
    isStoryLoading: false,
    isImageLoading: false,
  };
}

export function toContinueStoryPendingState(
  selection: string,
): ContinueStoryPendingState {
  return {
    isSelectionLoading: true,
    selectedChoice: selection,
    isStoryLoading: true,
    selections: [],
  };
}

export function toContinueStorySettledState(): ContinueStorySettledState {
  return {
    isStoryLoading: false,
    isSelectionLoading: false,
    selectedChoice: "",
  };
}

export function toTranslateStoryPendingState(): TranslateStoryPendingState {
  return {
    translationInProgress: true,
  };
}

export function toTranslateStorySettledState(): TranslateStorySettledState {
  return {
    translationInProgress: false,
  };
}
