import type { ThreadDiagnostics } from "@/lib/client/api/thread";

export interface MyStoryDetailMessage {
  text: string;
  text_en: string;
}

export interface MyStoryDetailHeaderProps {
  threadId: string;
  ableEnglish: boolean;
  isShowEnglish: boolean;
  onToggleEnglish: () => void;
}

export interface MyStoryDetailEmptyStateProps {
  errorMessage: string | null;
  onRetry: () => void;
}

export interface MyStoryDetailImageSectionProps {
  imageUrl: string;
}

export interface MyStoryDetailMessageSectionProps {
  messages: MyStoryDetailMessage[];
  ableEnglish: boolean;
  isShowEnglish: boolean;
}

export interface MyStoryDetailDiagnosticsBannerProps {
  diagnostics: ThreadDiagnostics;
}
