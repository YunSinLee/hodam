import type { ThreadWithUser } from "@/app/types/openai";

export interface MyStoryPageState {
  isLoading: boolean;
  isAuthReady: boolean;
  isPageLoaded: boolean;
  threads: ThreadWithUser[];
}

export interface MyStoryErrorState {
  message: string;
  actionLabel: string;
}

export interface MyStoryBannerState {
  error: MyStoryErrorState | null;
  warningMessage: string | null;
}

export interface MyStoryHandlers {
  onErrorAction: () => void;
}
