"use client";

import { useCallback, useEffect, useState } from "react";

import Image from "next/image";
import { useRouter } from "next/navigation";

import type {
  KpiDailyItem,
  KpiRetentionDailyItem,
  KpiUserRetention,
} from "@/app/api/v1/types";
import { recoverSessionUserInfo } from "@/lib/auth/session-recovery";
import { buildSignInRedirectPath } from "@/lib/auth/sign-in-redirect";
import analyticsApi from "@/lib/client/api/analytics";
import paymentApi from "@/lib/client/api/payment";
import profileApi, {
  PaymentHistory,
  RecentStory,
  UserProfile,
  UserStats,
} from "@/lib/client/api/profile";
import userApi from "@/lib/client/api/user";
import { resolveProtectedPageErrorState } from "@/lib/ui/protected-page-error";
import useBead from "@/services/hooks/use-bead";
import useUserInfo from "@/services/hooks/use-user-info";

interface PageFeedback {
  type: "error" | "success";
  message: string;
}

type ConfirmAction = "logout" | "removeImage" | null;

function getPaymentStatusMeta(status: string) {
  if (status === "completed") {
    return {
      badgeClass: "bg-green-100 text-green-600",
      label: "완료",
    };
  }

  if (status === "pending") {
    return {
      badgeClass: "bg-yellow-100 text-yellow-600",
      label: "대기",
    };
  }

  return {
    badgeClass: "bg-red-100 text-red-600",
    label: "실패",
  };
}

function toNumberLike(value: number | string | undefined | null): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function toPercentText(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export default function ProfilePage() {
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

  // 닉네임 편집 관련 상태
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [newNickname, setNewNickname] = useState("");
  const [isUpdatingNickname, setIsUpdatingNickname] = useState(false);

  // 프로필 이미지 관련 상태
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showImageOptions, setShowImageOptions] = useState(false);
  const [pageFeedback, setPageFeedback] = useState<PageFeedback | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [shouldRedirectToSignIn, setShouldRedirectToSignIn] = useState(false);

  const applyProtectedError = useCallback(
    (error: unknown, fallbackMessage: string) => {
      const errorState = resolveProtectedPageErrorState(error, fallbackMessage);
      setPageFeedback({
        type: "error",
        message: errorState.message,
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

        const [summary, paymentsData] = await Promise.all([
          profileApi.getProfileSummary(5),
          paymentApi.getPaymentHistory(),
        ]);
        setProfile(summary.profile);
        setStats(summary.stats);
        setRecentStories(summary.recentStories);
        setPaymentHistory(paymentsData.slice(0, 5)); // 최근 5개만

        try {
          const kpi = await analyticsApi.getKpi(14);
          setKpiDaily(kpi.data.daily || []);
          setKpiRetentionDaily(kpi.data.retentionDaily || []);
          setKpiUserRetention(kpi.data.userRetention || null);

          if (kpi.diagnostics.degraded) {
            const reasonText =
              kpi.diagnostics.reasons.length > 0
                ? kpi.diagnostics.reasons.join(", ")
                : "unknown";
            setKpiWarningMessage(
              `일부 KPI 지표는 보조 경로로 조회되었습니다. (reasons=${reasonText})`,
            );
          }
        } catch {
          setKpiDaily([]);
          setKpiRetentionDaily([]);
          setKpiUserRetention(null);
          setKpiWarningMessage(
            "활동 KPI를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
          );
        }
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

      if (userInfo.id) {
        setIsAuthReady(true);
        await loadProfileData(userInfo.id);
        return;
      }

      const recoveredUserInfo = await recoverSessionUserInfo();
      if (cancelled) return;

      if (!recoveredUserInfo?.id) {
        setIsLoading(false);
        setIsAuthReady(true);
        setPageFeedback({
          type: "error",
          message: "로그인이 필요합니다. 다시 로그인해주세요.",
        });
        setShouldRedirectToSignIn(true);
        return;
      }

      setUserInfo(recoveredUserInfo);
      setIsAuthReady(true);
      await loadProfileData(recoveredUserInfo.id);
    };

    initialize();

    return () => {
      cancelled = true;
    };
  }, [loadProfileData, setUserInfo, userInfo.id]);

  useEffect(() => {
    if (!shouldRedirectToSignIn) return undefined;

    const timer = setTimeout(() => {
      router.replace(buildSignInRedirectPath("/profile"));
    }, 800);

    return () => clearTimeout(timer);
  }, [router, shouldRedirectToSignIn]);

  const handleLogout = () => {
    setConfirmAction("logout");
  };

  const confirmLogout = async () => {
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
  };

  const handleNicknameEdit = () => {
    setNewNickname(profile?.display_name || "");
    setIsEditingNickname(true);
  };

  const handleNicknameUpdate = async () => {
    if (!userInfo.id || !newNickname.trim()) return;

    setIsUpdatingNickname(true);
    setPageFeedback(null);
    try {
      const success = await profileApi.updateDisplayName(
        userInfo.id,
        newNickname.trim(),
      );

      if (success) {
        // 프로필 정보 다시 로드
        await loadProfileData();
        setIsEditingNickname(false);
        setPageFeedback({
          type: "success",
          message: "닉네임이 성공적으로 변경되었습니다.",
        });
      } else {
        setPageFeedback({
          type: "error",
          message: "닉네임 업데이트에 실패했습니다. 다시 시도해주세요.",
        });
      }
    } catch (error) {
      applyProtectedError(error, "닉네임 업데이트 중 오류가 발생했습니다.");
    } finally {
      setIsUpdatingNickname(false);
    }
  };

  const handleNicknameCancel = () => {
    setIsEditingNickname(false);
    setNewNickname("");
  };

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file || !userInfo.id) return;

    setPageFeedback(null);

    // 파일 크기 체크 (5MB 제한)
    if (file.size > 5 * 1024 * 1024) {
      setPageFeedback({
        type: "error",
        message: "파일 크기는 5MB 이하여야 합니다.",
      });
      return;
    }

    // 파일 타입 체크
    if (!file.type.startsWith("image/")) {
      setPageFeedback({
        type: "error",
        message: "이미지 파일만 업로드 가능합니다.",
      });
      return;
    }

    setIsUploadingImage(true);
    try {
      const imageUrl = await profileApi.uploadProfileImage(userInfo.id, file);
      if (imageUrl) {
        // 프로필 정보 다시 로드
        await loadProfileData();
        setShowImageOptions(false);
        setPageFeedback({
          type: "success",
          message: "프로필 이미지가 업데이트되었습니다.",
        });
      } else {
        setPageFeedback({
          type: "error",
          message: "이미지 업로드에 실패했습니다.",
        });
      }
    } catch (error) {
      applyProtectedError(error, "이미지 업로드 중 오류가 발생했습니다.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleImageRemove = () => {
    setConfirmAction("removeImage");
    setShowImageOptions(false);
  };

  const confirmImageRemove = async () => {
    if (!userInfo.id) return;

    setPageFeedback(null);
    setIsUploadingImage(true);
    try {
      const success = await profileApi.removeCustomProfileImage(userInfo.id);
      if (success) {
        // 프로필 정보 다시 로드
        await loadProfileData();
        setPageFeedback({
          type: "success",
          message: "프로필 이미지가 기본 이미지로 변경되었습니다.",
        });
      } else {
        setPageFeedback({
          type: "error",
          message: "이미지 삭제에 실패했습니다.",
        });
      }
    } catch (error) {
      applyProtectedError(error, "이미지 삭제 중 오류가 발생했습니다.");
    } finally {
      setIsUploadingImage(false);
      setConfirmAction(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ko-KR").format(amount);
  };

  const latestKpiDaily = kpiDaily[0] || null;
  const latestKpiRetention = kpiRetentionDaily[0] || null;
  const latestCostPerStory = toNumberLike(latestKpiDaily?.cost_per_story);
  const latestD1Retention = toNumberLike(latestKpiRetention?.d1_retention_rate);
  const latestD7Retention = toNumberLike(latestKpiRetention?.d7_retention_rate);

  if (isLoading || !isAuthReady) {
    return (
      <div className="hodam-page-shell min-h-screen px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl rounded-3xl border border-[#ef8d3d]/20 bg-white/90 px-6 py-12 text-center shadow-[0_16px_38px_rgba(181,94,23,0.12)]">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-[#ef8d3d]" />
          <p className="text-[#5f6670]">프로필을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="hodam-page-shell min-h-screen px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl rounded-3xl border border-[#ef8d3d]/20 bg-white/90 px-6 py-12 text-center shadow-[0_16px_38px_rgba(181,94,23,0.12)]">
          <p className="mb-4 text-[#5f6670]">프로필을 불러올 수 없습니다.</p>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="hodam-primary-button text-sm"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="hodam-page-shell min-h-screen px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="hodam-glass-card mb-6 p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#ad6220]">
            Profile
          </p>
          <h1 className="hodam-heading mt-2 text-3xl text-[#2e3134] sm:text-4xl">
            내 프로필
          </h1>
          <p className="mt-2 text-sm text-[#5f6670] sm:text-base">
            계정 정보와 활동 내역을 한 화면에서 확인하세요.
          </p>
        </header>
        {pageFeedback && (
          <div
            className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${
              pageFeedback.type === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-green-200 bg-green-50 text-green-700"
            }`}
          >
            {pageFeedback.message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 왼쪽: 프로필 정보 */}
          <div className="lg:col-span-1">
            {/* 기본 정보 카드 */}
            <div className="hodam-soft-card p-6 mb-6">
              <div className="text-center">
                {/* 프로필 이미지 */}
                <div className="relative w-24 h-24 mx-auto mb-4">
                  <div
                    className="w-24 h-24 rounded-full bg-gradient-to-r from-[#ef8d3d] to-[#f2ab4e] flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setShowImageOptions(true)}
                  >
                    {profile.profileUrl ? (
                      <Image
                        src={profile.profileUrl}
                        alt="프로필"
                        className="w-24 h-24 rounded-full object-cover"
                        width={96}
                        height={96}
                      />
                    ) : (
                      <span className="text-white text-2xl font-bold">
                        {profile.display_name?.charAt(0).toUpperCase() ||
                          profile.email.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* 카메라 아이콘 */}
                  <button
                    type="button"
                    onClick={() => setShowImageOptions(true)}
                    className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-[#ef8d3d] text-white shadow-lg transition-colors hover:bg-[#d97c30]"
                    title="프로필 이미지 변경"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </button>
                </div>

                {/* 닉네임 표시 및 편집 */}
                <div className="mb-2">
                  {isEditingNickname ? (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={newNickname}
                        onChange={e => setNewNickname(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-[#ef8d3d]"
                        placeholder="닉네임을 입력하세요"
                        maxLength={20}
                      />
                      <div className="flex gap-2 justify-center">
                        <button
                          type="button"
                          onClick={handleNicknameUpdate}
                          disabled={isUpdatingNickname || !newNickname.trim()}
                          className="rounded-lg bg-[#ef8d3d] px-3 py-1 text-sm text-white transition-colors hover:bg-[#d97c30] disabled:cursor-not-allowed disabled:bg-gray-400"
                        >
                          {isUpdatingNickname ? "저장 중..." : "저장"}
                        </button>
                        <button
                          type="button"
                          onClick={handleNicknameCancel}
                          disabled={isUpdatingNickname}
                          className="px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-400 disabled:cursor-not-allowed"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <h2 className="text-xl font-bold text-gray-800">
                        {profile.display_name || "닉네임 없음"}
                      </h2>
                      <button
                        type="button"
                        onClick={handleNicknameEdit}
                        className="p-1 text-gray-400 hover:text-[#bf6c28] transition-colors"
                        title="닉네임 편집"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>

                <p className="text-gray-600 text-sm mb-4">{profile.email}</p>
                <p className="text-gray-500 text-xs">
                  가입일: {formatDate(profile.created_at)}
                </p>
              </div>
            </div>

            {/* 곶감 정보 카드 */}
            <div className="hodam-soft-card p-6 mb-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                <span className="text-2xl mr-2">🍯</span>
                곶감 현황
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">보유 곶감</span>
                  <span className="text-xl font-bold text-[#bf6c28]">
                    {bead.count || 0}개
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">총 구매</span>
                  <span className="text-gray-800 font-semibold">
                    {stats?.totalBeadsPurchased || 0}개
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">총 사용</span>
                  <span className="text-gray-800 font-semibold">
                    {stats?.totalBeadsUsed || 0}개
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => router.push("/bead")}
                className="w-full mt-4 px-4 py-2 bg-gradient-to-r from-[#ef8d3d] to-[#f2ab4e] text-white rounded-lg hover:from-[#d97c30] hover:to-[#e4973f] transition-all"
              >
                곶감 충전하기
              </button>
            </div>

            {/* 로그아웃 버튼 */}
            <button
              type="button"
              onClick={handleLogout}
              className="w-full rounded-xl border border-[#e9dac4] bg-[#fff5e7] px-4 py-3 text-[#8a531d] transition-colors hover:bg-[#ffedd2]"
            >
              로그아웃
            </button>
          </div>

          {/* 오른쪽: 활동 내역 */}
          <div className="lg:col-span-2">
            {/* 통계 카드들 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="hodam-soft-card p-6 text-center">
                <div className="text-3xl mb-2">📚</div>
                <div className="text-2xl font-bold text-[#bf6c28]">
                  {stats?.totalStories || 0}
                </div>
                <div className="text-gray-600 text-sm">생성한 동화</div>
              </div>
              <div className="hodam-soft-card p-6 text-center">
                <div className="text-3xl mb-2">💰</div>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(stats?.totalPaymentAmount || 0)}원
                </div>
                <div className="text-gray-600 text-sm">총 결제 금액</div>
              </div>
              <div className="hodam-soft-card p-6 text-center">
                <div className="text-3xl mb-2">🍯</div>
                <div className="text-2xl font-bold text-orange-600">
                  {stats?.totalBeadsPurchased || 0}
                </div>
                <div className="text-gray-600 text-sm">구매한 곶감</div>
              </div>
            </div>

            {/* KPI 요약 */}
            <div className="hodam-soft-card p-6 mb-8">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-800">
                  운영 KPI (최근 14일)
                </h3>
                <span className="text-xs text-gray-500">
                  create/retention/cost
                </span>
              </div>

              {kpiWarningMessage && (
                <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-700">
                  {kpiWarningMessage}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-xl border border-[#f0d7b6] bg-[#fff4e4] p-4">
                  <div className="mb-1 text-xs text-[#b56522]">
                    동화당 평균 AI 비용
                  </div>
                  <div className="text-xl font-bold text-[#9e581c]">
                    {latestCostPerStory.toFixed(2)}
                  </div>
                  <div className="text-[11px] text-[#bf6c28] mt-1">
                    cost_per_story
                  </div>
                </div>

                <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                  <div className="text-xs text-blue-700 mb-1">
                    전체 D1 리텐션
                  </div>
                  <div className="text-xl font-bold text-blue-800">
                    {toPercentText(latestD1Retention)}
                  </div>
                  <div className="text-[11px] text-blue-600 mt-1">
                    cohort-based
                  </div>
                </div>

                <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
                  <div className="text-xs text-indigo-700 mb-1">
                    전체 D7 리텐션
                  </div>
                  <div className="text-xl font-bold text-indigo-800">
                    {toPercentText(latestD7Retention)}
                  </div>
                  <div className="text-[11px] text-indigo-600 mt-1">
                    cohort-based
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                  <div className="text-xs text-emerald-700 mb-1">
                    내 리텐션 상태
                  </div>
                  <div className="text-sm font-semibold text-emerald-800">
                    D1: {kpiUserRetention?.retained_d1 ? "달성" : "미달성"}
                  </div>
                  <div className="text-sm font-semibold text-emerald-800 mt-1">
                    D7: {kpiUserRetention?.retained_d7 ? "달성" : "미달성"}
                  </div>
                </div>
              </div>
            </div>

            {/* 최근 동화 */}
            <div className="hodam-soft-card p-6 mb-8">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-800">
                  최근 생성한 동화
                </h3>
                <button
                  type="button"
                  onClick={() => router.push("/my-story")}
                  className="text-[#bf6c28] hover:text-[#a95c20] text-sm"
                >
                  전체보기 →
                </button>
              </div>
              {recentStories.length > 0 ? (
                <div className="space-y-3">
                  {recentStories.map(story => (
                    <div
                      key={story.id}
                      className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                      onClick={() => router.push(`/my-story/${story.id}`)}
                    >
                      <div>
                        <h4 className="font-semibold text-gray-800">
                          {story.keywords && story.keywords.length > 0
                            ? story.keywords
                                .map((k: { keyword: string }) => k.keyword)
                                .join(", ")
                            : `동화 #${String(story.id).slice(-6)}`}
                        </h4>
                        <p className="text-gray-600 text-sm">
                          {formatDate(story.created_at)}
                        </p>
                      </div>
                      <span className="text-gray-400">→</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">📖</div>
                  <p>아직 생성한 동화가 없습니다.</p>
                  <button
                    type="button"
                    onClick={() => router.push("/service")}
                    className="mt-2 text-[#bf6c28] hover:text-[#a95c20]"
                  >
                    첫 동화 만들기 →
                  </button>
                </div>
              )}
            </div>

            {/* 결제 내역 */}
            <div className="hodam-soft-card p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-800">
                  최근 결제 내역
                </h3>
                <button
                  type="button"
                  onClick={() => router.push("/payment-history")}
                  className="text-[#bf6c28] hover:text-[#a95c20] text-sm"
                >
                  전체보기 →
                </button>
              </div>
              {paymentHistory.length > 0 ? (
                <div className="space-y-3">
                  {paymentHistory.map(payment => {
                    const statusMeta = getPaymentStatusMeta(payment.status);

                    return (
                      <div
                        key={payment.id}
                        className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <h4 className="font-semibold text-gray-800">
                            곶감 {payment.bead_quantity}개
                          </h4>
                          <p className="text-gray-600 text-sm">
                            {formatDate(payment.created_at)}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-gray-800">
                            {formatCurrency(payment.amount)}원
                          </div>
                          <div
                            className={`text-xs px-2 py-1 rounded-full ${statusMeta.badgeClass}`}
                          >
                            {statusMeta.label}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">💳</div>
                  <p>결제 내역이 없습니다.</p>
                  <button
                    type="button"
                    onClick={() => router.push("/bead")}
                    className="mt-2 text-[#bf6c28] hover:text-[#a95c20]"
                  >
                    곶감 충전하기 →
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 프로필 이미지 옵션 모달 */}
      {showImageOptions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white/95 rounded-2xl border border-[#ef8d3d]/20 p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-gray-800 mb-4 text-center">
              프로필 이미지 설정
            </h3>

            <div className="space-y-3">
              {/* 이미지 업로드 */}
              <label className="block">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={isUploadingImage}
                />
                <div className="w-full px-4 py-3 bg-[#ef8d3d] text-white rounded-lg hover:bg-[#d97c30] transition-colors cursor-pointer text-center disabled:bg-gray-400">
                  {isUploadingImage ? "업로드 중..." : "새 이미지 업로드"}
                </div>
              </label>

              {/* 커스텀 이미지 삭제 (커스텀 이미지가 있을 때만) */}
              {profile.custom_profile_url && (
                <button
                  type="button"
                  onClick={handleImageRemove}
                  disabled={isUploadingImage}
                  className="w-full px-4 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:bg-gray-400"
                >
                  {isUploadingImage ? "삭제 중..." : "기본 이미지로 되돌리기"}
                </button>
              )}

              {/* 취소 */}
              <button
                type="button"
                onClick={() => setShowImageOptions(false)}
                disabled={isUploadingImage}
                className="w-full px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:bg-gray-400"
              >
                취소
              </button>
            </div>

            <p className="text-xs text-gray-500 mt-4 text-center">
              • 최대 5MB까지 업로드 가능
              <br />• JPG, PNG, GIF 형식 지원
            </p>
          </div>
        </div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white/95 rounded-2xl border border-[#ef8d3d]/20 p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold text-gray-800 mb-3">
              {confirmAction === "logout"
                ? "로그아웃 확인"
                : "이미지 삭제 확인"}
            </h3>
            <p className="text-sm text-gray-600 mb-5">
              {confirmAction === "logout"
                ? "정말 로그아웃하시겠습니까?"
                : "커스텀 프로필 이미지를 삭제하고 소셜 로그인 이미지로 되돌릴까요?"}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                취소
              </button>
              <button
                type="button"
                onClick={
                  confirmAction === "logout"
                    ? confirmLogout
                    : confirmImageRemove
                }
                className="px-4 py-2 bg-[#ef8d3d] text-white rounded-lg hover:bg-[#d97c30]"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
