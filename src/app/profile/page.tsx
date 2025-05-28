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
                <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 flex items-center justify-center">
                  {profile.profileUrl ? (
                    <img
                      src={profile.profileUrl}
                      alt="프로필"
                      className="w-24 h-24 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-white text-2xl font-bold">
                      {profile.email.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-1">
                  {profile.email.split("@")[0]}
                </h2>
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
    </div>
  );
}
