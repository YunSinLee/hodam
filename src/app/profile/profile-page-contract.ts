import type { ChangeEvent } from "react";

import type {
  PaymentHistory,
  RecentStory,
  UserProfile,
  UserStats,
} from "@/lib/client/api/profile";

export type ProfilePageFeedbackActionType = "goSignIn" | "retry";

export interface ProfilePageFeedback {
  type: "error" | "success";
  message: string;
  actionType?: ProfilePageFeedbackActionType;
  actionLabel?: string;
}

export type ProfileConfirmAction = "logout" | "removeImage" | null;

export interface ProfilePageState {
  isLoading: boolean;
  isAuthReady: boolean;
  profile: UserProfile | null;
  pageFeedback: ProfilePageFeedback | null;
}

export interface ProfilePageHandlers {
  onGoHome: () => void;
  onGoSignIn: () => void;
  onRetryLoadProfile: () => void;
  onPageFeedbackAction?: () => void;
}

export interface ProfileSidebarState {
  profile: UserProfile;
  stats: UserStats | null;
  beadCount: number;
  isEditingNickname: boolean;
  newNickname: string;
  isUpdatingNickname: boolean;
}

export interface ProfileSidebarHandlers {
  onOpenImageOptions: () => void;
  onStartNicknameEdit: () => void;
  onNicknameInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSubmitNicknameUpdate: () => void;
  onCancelNicknameEdit: () => void;
  onGoBead: () => void;
  onLogout: () => void;
}

export interface ProfileActivityState {
  stats: UserStats | null;
  kpiWarningMessage: string | null;
  latestCostPerStory: number;
  latestAuthCallbackSuccess: number;
  latestAuthCallbackError: number;
  latestAuthCallbackSuccessGoogle: number;
  latestAuthCallbackSuccessKakao: number;
  latestAuthCallbackErrorGoogle: number;
  latestAuthCallbackErrorKakao: number;
  latestD1Retention: number;
  latestD7Retention: number;
  retainedD1: boolean;
  retainedD7: boolean;
  recentStories: RecentStory[];
  paymentHistory: PaymentHistory[];
}

export interface ProfileActivityHandlers {
  onGoMyStory: () => void;
  onOpenStoryDetail: (storyId: number) => void;
  onGoService: () => void;
  onGoPaymentHistory: () => void;
  onGoBead: () => void;
}

export interface ProfileModalState {
  showImageOptions: boolean;
  isUploadingImage: boolean;
  hasCustomProfileImage: boolean;
  confirmAction: ProfileConfirmAction;
}

export interface ProfileModalHandlers {
  onUploadImage: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
  onCloseImageOptions: () => void;
  onCancelConfirmAction: () => void;
  onConfirmAction: () => void;
}

export interface ProfileFormatters {
  formatDate: (dateString: string) => string;
  formatCurrency: (amount: number) => string;
}
