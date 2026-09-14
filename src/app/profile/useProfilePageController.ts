"use client";

import { useCallback, useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import type {
  KpiDailyItem,
  KpiRetentionDailyItem,
  KpiUserRetention,
} from "@/app/api/v1/types";
import { resolveProfileKpiSummary } from "@/app/profile/profile-kpi-summary";
import {
  canSubmitNicknameUpdate,
  hasProfilePageFeedbackAction,
  resolveConfirmActionType,
  resolveNicknameUpdateFeedback,
  resolveProfilePageFeedbackIntent,
  resolveProfileImageRemoveFeedback,
  resolveProfileImageUploadFeedback,
  sanitizeNickname,
} from "@/app/profile/profile-page-action-utils";
import type {
  ProfileActivityHandlers,
  ProfileActivityState,
  ProfileConfirmAction,
  ProfileFormatters,
  ProfileModalHandlers,
  ProfileModalState,
  ProfilePageFeedback,
  ProfilePageHandlers,
  ProfilePageState,
  ProfileSidebarHandlers,
  ProfileSidebarState,
} from "@/app/profile/profile-page-contract";
import { loadProfilePageData } from "@/app/profile/profile-page-data-loader";
import {
  createProfileSignInRequiredFeedback,
  resolveProfilePageInitialization,
} from "@/app/profile/profile-page-init";
import { recoverSessionUserInfo } from "@/lib/auth/session-recovery";
import { buildSignInRedirectPath } from "@/lib/auth/sign-in-redirect";
import profileApi, {
  PaymentHistory,
  RecentStory,
  UserProfile,
  UserStats,
} from "@/lib/client/api/profile";
import userApi from "@/lib/client/api/user";
import { resolveProfileImageErrorMessage } from "@/lib/ui/profile-image-error";
import { validateProfileImageFile } from "@/lib/ui/profile-image-validation";
import {
  getProtectedPageFeedbackAction,
  resolveProtectedPageErrorState,
} from "@/lib/ui/protected-page-error";
import { scheduleProtectedPageSignInRedirect } from "@/lib/ui/protected-page-redirect";
import useBead from "@/services/hooks/use-bead";
import useUserInfo from "@/services/hooks/use-user-info";

export default function useProfilePageController() {
  const { userInfo, deleteUserInfo, setUserInfo } = useUserInfo();
  const { bead, deleteBead } = useBead();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [recentStories, setRecentStories] = useState<RecentStory[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [kpiDaily, setKpiDaily] = useState<KpiDailyItem[]>([]);
  const [kpiRetentionDaily, setKpiRetentionDaily] = useState<
    KpiRetentionDailyItem[]
  >([]);
  const [kpiUserRetention, setKpiUserRetention] =
    useState<KpiUserRetention | null>(null);
  const [kpiWarningMessage, setKpiWarningMessage] = useState<string | null>(
    null,
  );

  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [newNickname, setNewNickname] = useState("");
  const [isUpdatingNickname, setIsUpdatingNickname] = useState(false);

  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showImageOptions, setShowImageOptions] = useState(false);
  const [pageFeedback, setPageFeedback] = useState<ProfilePageFeedback | null>(
    null,
  );
  const [confirmAction, setConfirmAction] =
    useState<ProfileConfirmAction>(null);
  const [shouldRedirectToSignIn, setShouldRedirectToSignIn] = useState(false);

  const applyProtectedError = useCallback(
    (error: unknown, fallbackMessage: string) => {
      const errorState = resolveProtectedPageErrorState(error, fallbackMessage);
      const action = getProtectedPageFeedbackAction(errorState);
      setPageFeedback({
        type: "error",
        message: errorState.message,
        actionType: action.type,
        actionLabel: action.label,
      });
      setShouldRedirectToSignIn(errorState.shouldRedirectToSignIn);
      return errorState;
    },
    [],
  );

  const applyProfileImageError = useCallback(
    (error: unknown, fallbackMessage: string) => {
      const errorState = resolveProtectedPageErrorState(error, fallbackMessage);
      const action = getProtectedPageFeedbackAction(errorState);
      setPageFeedback({
        type: "error",
        message: resolveProfileImageErrorMessage(error, errorState.message),
        actionType: action.type,
        actionLabel: action.label,
      });
      setShouldRedirectToSignIn(errorState.shouldRedirectToSignIn);
      return errorState;
    },
    [],
  );

  const loadProfileData = useCallback(
    async (resolvedUserId?: string) => {
      const activeUserId = resolvedUserId || userInfo.id;
      if (!activeUserId) return;

      try {
        setPageFeedback(null);
        setShouldRedirectToSignIn(false);
        setIsLoading(true);
        setKpiWarningMessage(null);

        const snapshot = await loadProfilePageData();
        setProfile(snapshot.profile);
        setStats(snapshot.stats);
        setRecentStories(snapshot.recentStories);
        setPaymentHistory(snapshot.paymentHistory);
        setKpiDaily(snapshot.kpiDaily);
        setKpiRetentionDaily(snapshot.kpiRetentionDaily);
        setKpiUserRetention(snapshot.kpiUserRetention);
        setKpiWarningMessage(snapshot.kpiWarningMessage);
      } catch (error) {
        applyProtectedError(
          error,
          "프로필 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [applyProtectedError, userInfo.id],
  );

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      setIsAuthReady(false);

      const recoveredUserInfo = userInfo.id
        ? null
        : await recoverSessionUserInfo();
      if (cancelled) return;

      const initResult = resolveProfilePageInitialization({
        currentUserId: userInfo.id,
        recoveredUserInfo,
      });

      if (initResult.mode === "unauthenticated") {
        setIsLoading(false);
        setIsAuthReady(true);
        setPageFeedback(createProfileSignInRequiredFeedback());
        setShouldRedirectToSignIn(true);
        return;
      }

      if (
        initResult.shouldSetRecoveredUserInfo &&
        initResult.recoveredUserInfo
      ) {
        setUserInfo(initResult.recoveredUserInfo);
      }

      setIsAuthReady(true);
      await loadProfileData(initResult.userId || undefined);
    };

    initialize();

    return () => {
      cancelled = true;
    };
  }, [loadProfileData, setUserInfo, userInfo.id]);

  useEffect(() => {
    if (!shouldRedirectToSignIn) return undefined;

    return scheduleProtectedPageSignInRedirect({
      router,
      returnPath: "/profile",
    });
  }, [router, shouldRedirectToSignIn]);

  const onGoHome = useCallback(() => {
    router.push("/");
  }, [router]);

  const onGoSignIn = useCallback(() => {
    router.replace(buildSignInRedirectPath("/profile"));
  }, [router]);

  const onGoBead = useCallback(() => {
    router.push("/bead");
  }, [router]);

  const onGoMyStory = useCallback(() => {
    router.push("/my-story");
  }, [router]);

  const onGoService = useCallback(() => {
    router.push("/service");
  }, [router]);

  const onGoPaymentHistory = useCallback(() => {
    router.push("/payment-history");
  }, [router]);

  const onOpenStoryDetail = useCallback(
    (storyId: number) => {
      router.push(`/my-story/${storyId}`);
    },
    [router],
  );

  const onOpenImageOptions = useCallback(() => {
    setShowImageOptions(true);
  }, []);

  const onCloseImageOptions = useCallback(() => {
    setShowImageOptions(false);
  }, []);

  const onNicknameInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setNewNickname(event.target.value);
    },
    [],
  );

  const onCancelConfirmAction = useCallback(() => {
    setConfirmAction(null);
  }, []);

  const onLogout = useCallback(() => {
    setConfirmAction("logout");
  }, []);

  const confirmLogout = useCallback(async () => {
    try {
      await userApi.signOut();
    } catch {
      // Clear local auth state even if remote sign-out request fails.
    }

    deleteUserInfo();
    deleteBead();
    setConfirmAction(null);
    router.replace("/");
    router.refresh();
  }, [deleteBead, deleteUserInfo, router]);

  const onStartNicknameEdit = useCallback(() => {
    setNewNickname(profile?.display_name || "");
    setIsEditingNickname(true);
  }, [profile?.display_name]);

  const onSubmitNicknameUpdate = useCallback(async () => {
    const userId = userInfo.id;
    if (!userId) return;
    const sanitizedNickname = sanitizeNickname(newNickname);
    if (!canSubmitNicknameUpdate(userId, sanitizedNickname)) return;

    setIsUpdatingNickname(true);
    setPageFeedback(null);
    try {
      const success = await profileApi.updateDisplayName(
        userId,
        sanitizedNickname,
      );

      if (success) {
        await loadProfileData();
        setIsEditingNickname(false);
      }
      setPageFeedback(resolveNicknameUpdateFeedback(success));
    } catch (error) {
      applyProtectedError(error, "닉네임 업데이트 중 오류가 발생했습니다.");
    } finally {
      setIsUpdatingNickname(false);
    }
  }, [applyProtectedError, loadProfileData, newNickname, userInfo.id]);

  const onCancelNicknameEdit = useCallback(() => {
    setIsEditingNickname(false);
    setNewNickname("");
  }, []);

  const onRetryLoadProfile = useCallback(() => {
    loadProfileData().catch(() => undefined);
  }, [loadProfileData]);

  const onPageFeedbackAction = useCallback(() => {
    const feedbackIntent = resolveProfilePageFeedbackIntent(
      pageFeedback?.actionType,
    );
    if (feedbackIntent === "goSignIn") {
      onGoSignIn();
      return;
    }
    if (feedbackIntent === "retry") {
      onRetryLoadProfile();
    }
  }, [onGoSignIn, onRetryLoadProfile, pageFeedback?.actionType]);

  const onUploadImage = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !userInfo.id) return;

      setPageFeedback(null);

      const fileValidationMessage = validateProfileImageFile(file);
      if (fileValidationMessage) {
        setPageFeedback({
          type: "error",
          message: fileValidationMessage,
        });
        return;
      }

      setIsUploadingImage(true);
      try {
        const imageUrl = await profileApi.uploadProfileImage(userInfo.id, file);
        if (imageUrl) {
          await loadProfileData();
          setShowImageOptions(false);
        }
        setPageFeedback(resolveProfileImageUploadFeedback(Boolean(imageUrl)));
      } catch (error) {
        applyProfileImageError(error, "이미지 업로드 중 오류가 발생했습니다.");
      } finally {
        setIsUploadingImage(false);
      }
    },
    [applyProfileImageError, loadProfileData, userInfo.id],
  );

  const onRemoveImage = useCallback(() => {
    setConfirmAction("removeImage");
    setShowImageOptions(false);
  }, []);

  const confirmImageRemove = useCallback(async () => {
    if (!userInfo.id) return;

    setPageFeedback(null);
    setIsUploadingImage(true);
    try {
      const success = await profileApi.removeCustomProfileImage(userInfo.id);
      if (success) {
        await loadProfileData();
      }
      setPageFeedback(resolveProfileImageRemoveFeedback(success));
    } catch (error) {
      applyProfileImageError(error, "이미지 삭제 중 오류가 발생했습니다.");
    } finally {
      setIsUploadingImage(false);
      setConfirmAction(null);
    }
  }, [applyProfileImageError, loadProfileData, userInfo.id]);

  const onConfirmAction = useCallback(() => {
    const confirmActionType = resolveConfirmActionType(confirmAction);
    if (confirmActionType === "logout") {
      confirmLogout().catch(() => undefined);
      return;
    }
    if (confirmActionType === "removeImage") {
      confirmImageRemove().catch(() => undefined);
    }
  }, [confirmAction, confirmImageRemove, confirmLogout]);

  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, []);

  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat("ko-KR").format(amount);
  }, []);

  const kpiSummary = resolveProfileKpiSummary({
    kpiDaily,
    kpiRetentionDaily,
    kpiUserRetention,
  });

  const pageState: ProfilePageState = {
    isLoading,
    isAuthReady,
    profile,
    pageFeedback,
  };

  const pageHandlers: ProfilePageHandlers = {
    onGoHome,
    onGoSignIn,
    onRetryLoadProfile,
    onPageFeedbackAction: hasProfilePageFeedbackAction(pageFeedback?.actionType)
      ? onPageFeedbackAction
      : undefined,
  };

  const sidebarState: ProfileSidebarState | null = profile
    ? {
        profile,
        stats,
        beadCount: bead.count || 0,
        isEditingNickname,
        newNickname,
        isUpdatingNickname,
      }
    : null;

  const sidebarHandlers: ProfileSidebarHandlers = {
    onOpenImageOptions,
    onStartNicknameEdit,
    onNicknameInputChange,
    onSubmitNicknameUpdate,
    onCancelNicknameEdit,
    onGoBead,
    onLogout,
  };

  const activityState: ProfileActivityState = {
    stats,
    kpiWarningMessage,
    ...kpiSummary,
    recentStories,
    paymentHistory,
  };

  const activityHandlers: ProfileActivityHandlers = {
    onGoMyStory,
    onOpenStoryDetail,
    onGoService,
    onGoPaymentHistory,
    onGoBead,
  };

  const modalState: ProfileModalState = {
    showImageOptions,
    isUploadingImage,
    hasCustomProfileImage: Boolean(profile?.custom_profile_url),
    confirmAction,
  };

  const modalHandlers: ProfileModalHandlers = {
    onUploadImage,
    onRemoveImage,
    onCloseImageOptions,
    onCancelConfirmAction,
    onConfirmAction,
  };

  const formatters: ProfileFormatters = {
    formatDate,
    formatCurrency,
  };

  return {
    pageState,
    pageHandlers,
    sidebarState,
    sidebarHandlers,
    activityState,
    activityHandlers,
    modalState,
    modalHandlers,
    formatters,
  };
}
