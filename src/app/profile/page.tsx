"use client";

import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import paymentApi from "@/app/api/payment";
import profileApi, {
  PaymentHistory,
  RecentStory,
  UserProfile,
  UserStats,
} from "@/app/api/profile";
import useBead from "@/services/hooks/use-bead";
import useUserInfo from "@/services/hooks/use-user-info";

export default function ProfilePage() {
  const { userInfo, deleteUserInfo } = useUserInfo();
  const { bead } = useBead();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [recentStories, setRecentStories] = useState<RecentStory[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);

  // 닉네임 편집 관련 상태
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [newNickname, setNewNickname] = useState("");
  const [isUpdatingNickname, setIsUpdatingNickname] = useState(false);

  // 프로필 이미지 관련 상태
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showImageOptions, setShowImageOptions] = useState(false);

  useEffect(() => {
    if (!userInfo.id) {
      router.push("/sign-in");
      return;
    }

    loadProfileData();
  }, [userInfo.id, router]);

  const loadProfileData = async () => {
    if (!userInfo.id) return;

    try {
      setIsLoading(true);

      // 프로필 정보 로드
      const profileData = await profileApi.getUserProfile(userInfo.id);
      setProfile(profileData);

      // 통계 정보 로드
      const statsData = await profileApi.getUserStats(userInfo.id);
      setStats(statsData);

      // 최근 동화 목록 로드
      const storiesData = await profileApi.getRecentStories(userInfo.id, 5);
      setRecentStories(storiesData);

      // 결제 내역 로드
      const paymentsData = await paymentApi.getPaymentHistory(userInfo.id);
      setPaymentHistory(paymentsData.slice(0, 5)); // 최근 5개만
    } catch (error) {
      console.error("프로필 데이터 로드 오류:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    if (confirm("정말 로그아웃하시겠습니까?")) {
      deleteUserInfo();
      router.push("/");
    }
  };

  const handleNicknameEdit = () => {
    setNewNickname(profile?.display_name || "");
    setIsEditingNickname(true);
  };

  const handleNicknameUpdate = async () => {
    if (!userInfo.id || !newNickname.trim()) return;

    setIsUpdatingNickname(true);
    try {
      console.log("닉네임 업데이트 시작:", {
        userId: userInfo.id,
        newNickname: newNickname.trim(),
      });

      const success = await profileApi.updateDisplayName(
        userInfo.id,
        newNickname.trim(),
      );

      if (success) {
        console.log("닉네임 업데이트 성공, 프로필 데이터 다시 로드");
        // 프로필 정보 다시 로드
        await loadProfileData();
        setIsEditingNickname(false);
        alert("닉네임이 성공적으로 변경되었습니다.");
      } else {
        console.error("닉네임 업데이트 실패");
        alert("닉네임 업데이트에 실패했습니다. 다시 시도해주세요.");
      }
    } catch (error) {
      console.error("닉네임 업데이트 오류:", error);
      alert("닉네임 업데이트 중 오류가 발생했습니다.");
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

    // 파일 크기 체크 (5MB 제한)
    if (file.size > 5 * 1024 * 1024) {
      alert("파일 크기는 5MB 이하여야 합니다.");
      return;
    }

    // 파일 타입 체크
    if (!file.type.startsWith("image/")) {
      alert("이미지 파일만 업로드 가능합니다.");
      return;
    }

    setIsUploadingImage(true);
    try {
      const imageUrl = await profileApi.uploadProfileImage(userInfo.id, file);
      if (imageUrl) {
        // 프로필 정보 다시 로드
        await loadProfileData();
        setShowImageOptions(false);
      } else {
        alert("이미지 업로드에 실패했습니다.");
      }
    } catch (error) {
      console.error("이미지 업로드 오류:", error);
      alert("이미지 업로드 중 오류가 발생했습니다.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleImageRemove = async () => {
    if (!userInfo.id) return;

    if (
      confirm(
        "커스텀 프로필 이미지를 삭제하고 소셜 로그인 이미지로 되돌리시겠습니까?",
      )
    ) {
      setIsUploadingImage(true);
      try {
        const success = await profileApi.removeCustomProfileImage(userInfo.id);
        if (success) {
          // 프로필 정보 다시 로드
          await loadProfileData();
          setShowImageOptions(false);
        } else {
          alert("이미지 삭제에 실패했습니다.");
        }
      } catch (error) {
        console.error("이미지 삭제 오류:", error);
        alert("이미지 삭제 중 오류가 발생했습니다.");
      } finally {
        setIsUploadingImage(false);
      }
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4" />
          <p className="text-gray-600">프로필을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">프로필을 불러올 수 없습니다.</p>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">내 프로필</h1>
          <p className="text-gray-600">계정 정보와 활동 내역을 확인하세요</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 왼쪽: 프로필 정보 */}
          <div className="lg:col-span-1">
            {/* 기본 정보 카드 */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
              <div className="text-center">
                {/* 프로필 이미지 */}
                <div className="relative w-24 h-24 mx-auto mb-4">
                  <div
                    className="w-24 h-24 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setShowImageOptions(true)}
                  >
                    {profile.profileUrl ? (
                      <img
                        src={profile.profileUrl}
                        alt="프로필"
                        className="w-24 h-24 rounded-full object-cover"
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
                    onClick={() => setShowImageOptions(true)}
                    className="absolute bottom-0 right-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white hover:bg-purple-700 transition-colors shadow-lg"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="닉네임을 입력하세요"
                        maxLength={20}
                      />
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={handleNicknameUpdate}
                          disabled={isUpdatingNickname || !newNickname.trim()}
                          className="px-3 py-1 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                          {isUpdatingNickname ? "저장 중..." : "저장"}
                        </button>
                        <button
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
                        onClick={handleNicknameEdit}
                        className="p-1 text-gray-400 hover:text-purple-600 transition-colors"
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
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                <span className="text-2xl mr-2">🍯</span>
                곶감 현황
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">보유 곶감</span>
                  <span className="text-xl font-bold text-purple-600">
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
                onClick={() => router.push("/bead")}
                className="w-full mt-4 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all"
              >
                곶감 충전하기
              </button>
            </div>

            {/* 로그아웃 버튼 */}
            <button
              onClick={handleLogout}
              className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              로그아웃
            </button>
          </div>

          {/* 오른쪽: 활동 내역 */}
          <div className="lg:col-span-2">
            {/* 통계 카드들 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-white rounded-xl shadow-lg p-6 text-center">
                <div className="text-3xl mb-2">📚</div>
                <div className="text-2xl font-bold text-purple-600">
                  {stats?.totalStories || 0}
                </div>
                <div className="text-gray-600 text-sm">생성한 동화</div>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6 text-center">
                <div className="text-3xl mb-2">💰</div>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(stats?.totalPaymentAmount || 0)}원
                </div>
                <div className="text-gray-600 text-sm">총 결제 금액</div>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6 text-center">
                <div className="text-3xl mb-2">🍯</div>
                <div className="text-2xl font-bold text-orange-600">
                  {stats?.totalBeadsPurchased || 0}
                </div>
                <div className="text-gray-600 text-sm">구매한 곶감</div>
              </div>
            </div>

            {/* 최근 동화 */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-800">
                  최근 생성한 동화
                </h3>
                <button
                  onClick={() => router.push("/my-story")}
                  className="text-purple-600 hover:text-purple-700 text-sm"
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
                    onClick={() => router.push("/service")}
                    className="mt-2 text-purple-600 hover:text-purple-700"
                  >
                    첫 동화 만들기 →
                  </button>
                </div>
              )}
            </div>

            {/* 결제 내역 */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-800">
                  최근 결제 내역
                </h3>
                <button
                  onClick={() => router.push("/payment-history")}
                  className="text-purple-600 hover:text-purple-700 text-sm"
                >
                  전체보기 →
                </button>
              </div>
              {paymentHistory.length > 0 ? (
                <div className="space-y-3">
                  {paymentHistory.map(payment => (
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
                          className={`text-xs px-2 py-1 rounded-full ${
                            payment.status === "completed"
                              ? "bg-green-100 text-green-600"
                              : payment.status === "pending"
                                ? "bg-yellow-100 text-yellow-600"
                                : "bg-red-100 text-red-600"
                          }`}
                        >
                          {payment.status === "completed"
                            ? "완료"
                            : payment.status === "pending"
                              ? "대기"
                              : "실패"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">💳</div>
                  <p>결제 내역이 없습니다.</p>
                  <button
                    onClick={() => router.push("/bead")}
                    className="mt-2 text-purple-600 hover:text-purple-700"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
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
                <div className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors cursor-pointer text-center disabled:bg-gray-400">
                  {isUploadingImage ? "업로드 중..." : "새 이미지 업로드"}
                </div>
              </label>

              {/* 커스텀 이미지 삭제 (커스텀 이미지가 있을 때만) */}
              {profile.custom_profile_url && (
                <button
                  onClick={handleImageRemove}
                  disabled={isUploadingImage}
                  className="w-full px-4 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:bg-gray-400"
                >
                  {isUploadingImage ? "삭제 중..." : "기본 이미지로 되돌리기"}
                </button>
              )}

              {/* 취소 */}
              <button
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
    </div>
  );
}
