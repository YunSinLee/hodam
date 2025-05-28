"use client";

import { useEffect, useState } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import beadApi from "@/app/api/bead";
import { supabase } from "@/app/utils/supabase";
import useBead from "@/services/hooks/use-bead";
import useUserInfo from "@/services/hooks/use-user-info";

// 토스페이먼츠 SDK 타입 정의
declare global {
  interface Window {
    TossPayments: any;
  }
}

function BeadPage() {
  const { bead, setBead } = useBead();
  const { userInfo, setUserInfo } = useUserInfo();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isLoading, setIsLoading] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<any>(null);
  const [processedPayments, setProcessedPayments] = useState<Set<string>>(
    new Set(),
  );

  // 토스페이먼츠 클라이언트 키 (환경변수에서 가져오기)
  const clientKey =
    process.env.NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY ||
    "test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq";

  useEffect(() => {
    // 토스페이먼츠 SDK 로드
    const script = document.createElement("script");
    script.src = "https://js.tosspayments.com/v1/payment";
    script.async = true;
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  useEffect(() => {
    // 결제 성공/실패 처리
    const paymentKey = searchParams.get("paymentKey");
    const orderId = searchParams.get("orderId");
    const amount = searchParams.get("amount");

    if (paymentKey && orderId && amount) {
      // 이미 처리된 결제인지 확인
      const paymentId = `${paymentKey}_${orderId}`;
      if (processedPayments.has(paymentId)) {
        console.log("이미 처리된 결제입니다:", paymentId);
        return;
      }

      // 처리 중인 결제로 표시
      setProcessedPayments(prev => new Set(prev).add(paymentId));

      handlePaymentSuccess(paymentKey, orderId, parseInt(amount, 10));
    }
  }, [searchParams, userInfo.id]);

  const handlePaymentSuccess = async (
    paymentKey: string,
    orderId: string,
    amount: number,
  ) => {
    const paymentId = `${paymentKey}_${orderId}`;
    console.log("결제 성공 처리 시작:", {
      paymentKey,
      orderId,
      amount,
      userId: userInfo.id,
      paymentId,
    });

    // 이미 로딩 중이면 중복 처리 방지
    if (isLoading) {
      console.log("이미 결제 처리 중입니다.");
      return;
    }

    let currentUserId = userInfo.id;

    // userInfo.id가 없으면 세션 복원을 기다림
    if (!currentUserId) {
      console.log("userInfo.id가 없음, 세션 복원 시도 중...");

      // 즉시 세션 확인
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user?.id) {
        console.log("세션 즉시 복원됨:", session.user.id);
        const userData = {
          profileUrl: session.user.user_metadata?.avatar_url || "",
          id: session.user.id,
          email: session.user.email,
        };
        setUserInfo(userData);
        currentUserId = session.user.id;
      } else {
        // 세션이 없으면 짧은 대기 후 재시도
        console.log("세션 없음, 잠시 대기 후 재시도...");

        for (let i = 0; i < 5; i++) {
          await new Promise<void>(resolve => {
            setTimeout(() => resolve(), 200);
          });

          const {
            data: { session: retrySession },
          } = await supabase.auth.getSession();

          if (retrySession?.user?.id) {
            console.log(
              `세션 복원됨 (${i + 1}번째 시도):`,
              retrySession.user.id,
            );
            const userData = {
              profileUrl: retrySession.user.user_metadata?.avatar_url || "",
              id: retrySession.user.id,
              email: retrySession.user.email,
            };
            setUserInfo(userData);
            currentUserId = retrySession.user.id;
            break;
          }

          console.log(`세션 복원 재시도 중... (${i + 1}/5)`);
        }
      }

      // 여전히 세션이 없으면 에러
      if (!currentUserId) {
        console.error("세션 복원 실패");
        alert("로그인 정보를 찾을 수 없습니다. 다시 로그인해주세요.");
        return;
      }
    }

    setIsLoading(true);
    try {
      console.log("결제 완료 처리 시작, userId:", currentUserId);
      const updatedBead = await beadApi.completeBeadPurchase(
        paymentKey,
        orderId,
        amount,
        currentUserId,
      );
      setBead(updatedBead);

      alert("곶감 충전이 완료되었습니다! 🎉");

      // URL 파라미터 제거
      router.replace("/bead");
    } catch (error: any) {
      console.error("결제 완료 처리 오류:", error);

      // 이미 처리된 결제인 경우 조용히 처리
      if (
        error?.message?.includes("이미 처리된") ||
        error?.code === "ALREADY_PROCESSED_PAYMENT"
      ) {
        console.log("이미 처리된 결제입니다. URL 파라미터를 제거합니다.");
        router.replace("/bead");
        return;
      }

      alert("결제 처리 중 오류가 발생했습니다. 고객센터로 문의해주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePurchase = async (packageInfo: any) => {
    if (!userInfo.id || !userInfo.email) {
      alert("로그인이 필요합니다.");
      return;
    }

    setIsLoading(true);
    setSelectedPackage(packageInfo);

    try {
      // 결제 요청 생성
      const { orderId, amount } = await beadApi.purchaseBeads(
        userInfo.id,
        userInfo.email,
        userInfo.email.split("@")[0], // 이메일에서 사용자명 추출
        packageInfo.quantity,
        packageInfo.price,
      );

      // 토스페이먼츠 결제 위젯 초기화
      const tossPayments = window.TossPayments(clientKey);

      // 결제 요청
      await tossPayments.requestPayment("카드", {
        amount,
        orderId,
        orderName: `곶감 ${packageInfo.quantity}개`,
        customerName: userInfo.email.split("@")[0],
        customerEmail: userInfo.email,
        successUrl: `${window.location.protocol}//${window.location.host}/bead`,
        failUrl: `${window.location.protocol}//${window.location.host}/bead?failed=true`,
      });
    } catch (error) {
      console.error("결제 요청 오류:", error);
      alert("결제 요청 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
      setSelectedPackage(null);
    }
  };

  const packages = beadApi.getBeadPackages();

  if (!userInfo.id) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            로그인이 필요합니다
          </h2>
          <p className="text-gray-600">곶감 충전을 위해 먼저 로그인해주세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <img src="/persimmon_240424.png" alt="곶감" className="w-20 h-20" />
        </div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">곶감 충전</h1>
        <p className="text-gray-600">AI 동화 생성에 필요한 곶감을 충전하세요</p>
      </div>

      {/* 현재 곶감 수량 */}
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl p-6 mb-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-2">
          <img src="/persimmon_240424.png" alt="곶감" className="w-8 h-8" />
          <span className="text-2xl font-bold text-orange-700">
            {bead?.count || 0}개
          </span>
        </div>
        <p className="text-orange-600">보유 중인 곶감</p>
      </div>

      {/* 곶감 패키지 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {packages.map(pkg => (
          <div
            key={pkg.id}
            className={`relative bg-white rounded-2xl border-2 p-6 text-center transition-all duration-300 hover:shadow-lg ${
              pkg.popular
                ? "border-orange-400 shadow-lg transform scale-105"
                : "border-gray-200 hover:border-orange-300"
            }`}
          >
            {pkg.popular && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                  인기
                </span>
              </div>
            )}

            <div className="flex items-center justify-center mb-4">
              <img
                src="/persimmon_240424.png"
                alt="곶감"
                className="w-12 h-12 mr-2"
              />
              <span className="text-2xl font-bold text-gray-800">
                ×{pkg.quantity}
              </span>
            </div>

            <div className="mb-4">
              <div className="text-sm text-gray-500 line-through mb-1">
                {pkg.originalPrice.toLocaleString()}원
              </div>
              <div className="text-2xl font-bold text-orange-600 mb-1">
                {pkg.price.toLocaleString()}원
              </div>
              <div className="text-sm text-green-600 font-medium">
                {pkg.discount}% 할인
              </div>
            </div>

            <p className="text-sm text-gray-500 mb-4">{pkg.description}</p>

            <button
              onClick={() => handlePurchase(pkg)}
              disabled={isLoading}
              className={`w-full py-3 px-4 rounded-xl font-medium transition-all duration-300 ${
                isLoading && selectedPackage?.id === pkg.id
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : pkg.popular
                    ? "bg-orange-500 hover:bg-orange-600 text-white shadow-lg hover:shadow-xl"
                    : "bg-gray-100 hover:bg-orange-100 text-gray-800 hover:text-orange-700"
              }`}
            >
              {isLoading && selectedPackage?.id === pkg.id ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mr-2" />
                  결제 중...
                </div>
              ) : (
                "구매하기"
              )}
            </button>
          </div>
        ))}
      </div>

      {/* 결제 내역 링크 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
        <h2 className="text-xl font-bold text-gray-800 mb-2">결제 내역</h2>
        <p className="text-gray-600 mb-4">곶감 구매 내역을 확인하세요</p>
        <button
          onClick={() => router.push("/payment-history")}
          className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all"
        >
          결제 내역 보기
        </button>
      </div>

      {/* 안내사항 */}
      <div className="mt-8 p-6 bg-blue-50 rounded-2xl">
        <h3 className="font-bold text-blue-800 mb-3">💡 곶감 사용 안내</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• 동화 생성: 1개</li>
          <li>• 영어 번역 추가: +1개</li>
          <li>• 이미지 생성 추가: +1개</li>
          <li>• 곶감은 환불되지 않으니 신중하게 구매해주세요</li>
          <li>• 결제 관련 문의: dldbstls7777@naver.com</li>
        </ul>
      </div>
    </div>
  );
}

export default BeadPage;
