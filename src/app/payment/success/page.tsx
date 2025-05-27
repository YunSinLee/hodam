"use client";

import { useEffect, useState } from "react";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import beadApi from "@/app/api/bead";
import useBead from "@/services/hooks/use-bead";
import useUserInfo from "@/services/hooks/use-user-info";

export default function PaymentSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userInfo } = useUserInfo();
  const { setBead } = useBead();

  const [isProcessing, setIsProcessing] = useState(true);
  const [paymentInfo, setPaymentInfo] = useState<any>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const processPayment = async () => {
      const paymentKey = searchParams.get("paymentKey");
      const orderId = searchParams.get("orderId");
      const amount = searchParams.get("amount");

      if (!paymentKey || !orderId || !amount || !userInfo.id) {
        setError("결제 정보가 올바르지 않습니다.");
        setIsProcessing(false);
        return;
      }

      try {
        const updatedBead = await beadApi.completeBeadPurchase(
          paymentKey,
          orderId,
          parseInt(amount, 10),
          userInfo.id,
        );

        setBead(updatedBead);
        setPaymentInfo({
          orderId,
          amount: parseInt(amount, 10),
          paymentKey,
        });
      } catch (error) {
        console.error("결제 처리 오류:", error);
        setError("결제 처리 중 오류가 발생했습니다.");
      } finally {
        setIsProcessing(false);
      }
    };

    if (userInfo.id) {
      processPayment();
    }
  }, [searchParams, userInfo.id, setBead]);

  if (isProcessing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-6 border-4 border-green-200 border-t-green-500 rounded-full animate-spin" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            결제 처리 중
          </h2>
          <p className="text-gray-600">잠시만 기다려주세요...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-50 flex items-center justify-center">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">결제 실패</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="space-y-3">
            <Link href="/bead">
              <button className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-6 rounded-xl transition-colors">
                다시 시도하기
              </button>
            </Link>
            <Link href="/">
              <button className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-xl transition-colors">
                홈으로 돌아가기
              </button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center">
      <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center">
        {/* 성공 아이콘 */}
        <div className="w-16 h-16 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
          <svg
            className="w-8 h-8 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        {/* 제목 */}
        <h2 className="text-2xl font-bold text-gray-800 mb-2">결제 완료!</h2>
        <p className="text-gray-600 mb-6">
          곶감 충전이 성공적으로 완료되었습니다.
        </p>

        {/* 결제 정보 */}
        {paymentInfo && (
          <div className="bg-gray-50 rounded-2xl p-6 mb-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">주문번호</span>
                <span className="font-medium text-gray-800 text-sm">
                  {paymentInfo.orderId}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">결제금액</span>
                <span className="font-bold text-orange-600 text-lg">
                  {paymentInfo.amount.toLocaleString()}원
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 곶감 아이콘 */}
        <div className="flex justify-center mb-6">
          <img src="/persimmon_240424.png" alt="곶감" className="w-12 h-12" />
        </div>

        {/* 액션 버튼 */}
        <div className="space-y-3">
          <Link href="/service">
            <button className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-6 rounded-xl transition-colors">
              동화 만들러 가기
            </button>
          </Link>
          <Link href="/bead">
            <button className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-xl transition-colors">
              곶감 충전 페이지
            </button>
          </Link>
          <Link href="/">
            <button className="w-full text-gray-500 hover:text-gray-700 font-medium py-2 transition-colors">
              홈으로 돌아가기
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
