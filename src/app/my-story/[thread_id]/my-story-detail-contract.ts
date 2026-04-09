import type { MyStoryDetailMessage } from "@/app/components/my-story-detail/my-story-detail-contract";
import type { ThreadDiagnostics } from "@/lib/client/api/thread";

export interface MyStoryDetailStatusState {
  isLoading: boolean;
  isPageLoaded: boolean;
}

export interface MyStoryDetailPageState {
  threadId: string;
  ableEnglish: boolean;
  isShowEnglish: boolean;
  imageUrl: string | null;
  messages: MyStoryDetailMessage[];
  errorMessage: string | null;
  diagnostics: ThreadDiagnostics | null;
}

export interface MyStoryDetailHandlers {
  onRetry: () => void;
  onToggleEnglish: () => void;
}
