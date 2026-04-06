"use client";

import { useCallback, useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { recoverSessionUserInfo } from "@/lib/auth/session-recovery";
import { buildSignInRedirectPath } from "@/lib/auth/sign-in-redirect";
import paymentApi, { PaymentHistory } from "@/lib/client/api/payment";
import { resolveProtectedPageErrorState } from "@/lib/ui/protected-page-error";
import useUserInfo from "@/services/hooks/use-user-info";

export default function PaymentHistoryPage() {
  const router = useRouter();
  const { userInfo, setUserInfo } = useUserInfo();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [payments, setPayments] = useState<PaymentHistory[]>([]);
  const [filter, setFilter] = useState<string>("all"); // all, completed, pending, failed
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [shouldRedirectToSignIn, setShouldRedirectToSignIn] = useState(false);

  const loadPaymentHistory = useCallback(
    async (resolvedUserId?: string) => {
      const activeUserId = resolvedUserId || userInfo.id;
      if (!activeUserId) return;

      try {
        setIsLoading(true);
        setErrorMessage(null);
        setShouldRedirectToSignIn(false);

        const data = await paymentApi.getPaymentHistory();
        setPayments(data);
      } catch (error) {
        const errorState = resolveProtectedPageErrorState(
          error,
          "결제 내역을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
        );
        setErrorMessage(errorState.message);
        setShouldRedirectToSignIn(errorState.shouldRedirectToSignIn);
      } finally {
        setIsLoading(false);
      }
    },
    [userInfo.id],
  );

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      setIsAuthReady(false);

      if (userInfo.id) {
        setIsAuthReady(true);
        await loadPaymentHistory(userInfo.id);
        return;
      }

      const recoveredUserInfo = await recoverSessionUserInfo();
      if (cancelled) return;

      if (!recoveredUserInfo?.id) {
        setIsLoading(false);
        setIsAuthReady(true);
        setErrorMessage("로그인이 필요합니다. 다시 로그인해주세요.");
        setShouldRedirectToSignIn(true);
        return;
      }

      setUserInfo(recoveredUserInfo);
      setIsAuthReady(true);
      await loadPaymentHistory(recoveredUserInfo.id);
    };

    initialize();

    return () => {
      cancelled = true;
    };
  }, [loadPaymentHistory, setUserInfo, userInfo.id]);

  useEffect(() => {
    if (!shouldRedirectToSignIn) return undefined;

    const timer = setTimeout(() => {
      router.replace(buildSignInRedirectPath("/payment-history"));
    }, 800);

    return () => clearTimeout(timer);
  }, [router, shouldRedirectToSignIn]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ko-KR").format(amount);
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed":
        return "완료";
      case "pending":
        return "대기중";
      case "failed":
        return "실패";
      case "cancelled":
        return "취소됨";
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-700";
      case "pending":
        return "bg-yellow-100 text-yellow-700";
      case "failed":
        return "bg-red-100 text-red-700";
      case "cancelled":
        return "bg-gray-100 text-gray-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const filteredPayments = payments.filter(payment => {
    if (filter === "all") return true;
    return payment.status === filter;
  });

  const totalAmount = payments
    .filter(p => p.status === "completed")
    .reduce((sum, p) => sum + p.amount, 0);

  const totalBeads = payments
    .filter(p => p.status === "completed")
    .reduce((sum, p) => sum + p.bead_quantity, 0);

  if (isLoading || !isAuthReady) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4" />
          <p className="text-gray-600">결제 내역을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* 헤더 */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="mr-4 p-2 rounded-lg hover:bg-white/50 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-gray-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <h1 className="text-3xl font-bold text-gray-800">결제 내역</h1>
          </div>
          <p className="text-gray-600">곶감 구매 내역을 확인하세요</p>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <div className="text-3xl mb-2">💰</div>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totalAmount)}원
            </div>
            <div className="text-gray-600 text-sm">총 결제 금액</div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <div className="text-3xl mb-2">🍯</div>
            <div className="text-2xl font-bold text-orange-600">
              {totalBeads}개
            </div>
            <div className="text-gray-600 text-sm">총 구매 곶감</div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <div className="text-3xl mb-2">📊</div>
            <div className="text-2xl font-bold text-purple-600">
              {payments.length}건
            </div>
            <div className="text-gray-600 text-sm">총 결제 건수</div>
          </div>
        </div>

        {/* 필터 */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex flex-wrap gap-2">
            {[
              { key: "all", label: "전체" },
              { key: "completed", label: "완료" },
              { key: "pending", label: "대기중" },
              { key: "failed", label: "실패" },
              { key: "cancelled", label: "취소됨" },
            ].map(({ key, label }) => (
              <button
                type="button"
                key={key}
                onClick={() => setFilter(key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === key
                    ? "bg-purple-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {errorMessage && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {/* 결제 내역 목록 */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {filteredPayments.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {filteredPayments.map(payment => (
                <div
                  key={payment.id}
                  className="p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <h3 className="text-lg font-semibold text-gray-800 mr-3">
                          곶감 {payment.bead_quantity}개
                        </h3>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                            payment.status,
                          )}`}
                        >
                          {getStatusText(payment.status)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>주문번호: {payment.order_id}</p>
                        {payment.payment_key && (
                          <p>결제키: {payment.payment_key}</p>
                        )}
                        <p>결제일: {formatDate(payment.created_at)}</p>
                        {payment.completed_at && (
                          <p>완료일: {formatDate(payment.completed_at)}</p>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 md:mt-0 md:text-right">
                      <div className="text-2xl font-bold text-gray-800">
                        {formatCurrency(payment.amount)}원
                      </div>
                      <div className="text-sm text-gray-600">
                        개당{" "}
                        {formatCurrency(
                          Math.round(payment.amount / payment.bead_quantity),
                        )}
                        원
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="text-4xl mb-4">💳</div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                {filter === "all"
                  ? "결제 내역이 없습니다"
                  : `${getStatusText(filter)} 내역이 없습니다`}
              </h3>
              <p className="text-gray-600 mb-6">
                곶감을 구매하여 호담과 함께 동화를 만들어보세요!
              </p>
              <button
                type="button"
                onClick={() => router.push("/bead")}
                className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all"
              >
                곶감 구매하기
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
