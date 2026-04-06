"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";

import { supabase } from "@/app/utils/supabase";
import beadApi from "@/lib/client/api/bead";
import type { BeadPackage } from "@/lib/payments/packages";
import { resolveTossClientKey } from "@/lib/payments/toss-client";
import useBead from "@/services/hooks/use-bead";
import useUserInfo from "@/services/hooks/use-user-info";

// 토스페이먼츠 SDK 타입 정의
interface TossPaymentsInstance {
  requestPayment: (
    method: string,
    options: {
      amount: number;
      orderId: string;
      orderName: string;
      customerName: string;
      customerEmail: string;
      successUrl: string;
      failUrl: string;
    },
  ) => Promise<void>;
}

type TossPaymentsFactory = (clientKey: string) => TossPaymentsInstance;

declare global {
  interface Window {
    TossPayments?: TossPaymentsFactory;
  }
}

interface PageFeedback {
  type: "error" | "success";
  message: string;
}

function BeadPageContent() {
  const { bead, setBead } = useBead();
  const { userInfo, setUserInfo, hasHydrated } = useUserInfo();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isLoading, setIsLoading] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<BeadPackage | null>(
    null,
  );
  const [processedPayments, setProcessedPayments] = useState<Set<string>>(
    new Set(),
  );
  const [pageFeedback, setPageFeedback] = useState<PageFeedback | null>(null);

  const tossClientKey = useMemo(() => resolveTossClientKey(), []);

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

  const syncUserFromSession = useCallback(async (): Promise<string | null> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      return null;
    }

    setUserInfo({
      profileUrl: session.user.user_metadata?.avatar_url || "",
      id: session.user.id,
      email: session.user.email,
    });

    return session.user.id;
  }, [setUserInfo]);

  const waitForSessionUserId = useCallback(
    async (attempt = 0): Promise<string | null> => {
      const restoredUserId = await syncUserFromSession();
      if (restoredUserId) return restoredUserId;

      if (attempt >= 4) return null;

      await new Promise<void>(resolve => {
        setTimeout(resolve, 200);
      });
      return waitForSessionUserId(attempt + 1);
    },
    [syncUserFromSession],
  );

  const handlePaymentSuccess = useCallback(
    async (paymentKey: string, orderId: string, amount: number) => {
      if (isLoading) return;
      setPageFeedback(null);

      const currentUserId = userInfo.id || (await waitForSessionUserId());
      if (!currentUserId) {
        setPageFeedback({
          type: "error",
          message: "로그인 정보를 찾을 수 없습니다. 다시 로그인해주세요.",
        });
        return;
      }

      setIsLoading(true);
      try {
        const updatedBead = await beadApi.completeBeadPurchase(
          paymentKey,
          orderId,
          amount,
        );
        setBead(updatedBead);
        setPageFeedback({
          type: "success",
          message: "곶감 충전이 완료되었습니다.",
        });

        // URL 파라미터 제거
        router.replace("/bead");
      } catch (error) {
        const alreadyProcessed =
          (error instanceof Error && error.message.includes("이미 처리된")) ||
          (typeof error === "object" &&
            error !== null &&
            "code" in error &&
            (error as { code?: string }).code === "ALREADY_PROCESSED_PAYMENT");

        // 이미 처리된 결제인 경우 조용히 처리
        if (alreadyProcessed) {
          setPageFeedback({
            type: "success",
            message: "이미 처리된 결제입니다.",
          });
          router.replace("/bead");
          return;
        }

        const message =
          error instanceof Error &&
          error.message &&
          (error.message.includes("처리 중") ||
            error.message.includes("로그인"))
            ? error.message
            : "결제 처리 중 오류가 발생했습니다. 고객센터로 문의해주세요.";

        setPageFeedback({
          type: "error",
          message,
        });
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, router, setBead, userInfo.id, waitForSessionUserId],
  );

  useEffect(() => {
    // 결제 성공/실패 처리
    const paymentKey = searchParams.get("paymentKey");
    const orderId = searchParams.get("orderId");
    const amountRaw = searchParams.get("amount");

    if (!paymentKey || !orderId || !amountRaw) return;

    const amount = Number(amountRaw);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPageFeedback({
        type: "error",
        message: "결제 파라미터가 올바르지 않습니다.",
      });
      return;
    }

    const paymentId = `${paymentKey}_${orderId}`;
    if (processedPayments.has(paymentId)) return;

    setProcessedPayments(prev => new Set(prev).add(paymentId));
    handlePaymentSuccess(paymentKey, orderId, amount);
  }, [handlePaymentSuccess, processedPayments, searchParams]);

  const handlePurchase = useCallback(
    async (packageInfo: BeadPackage) => {
      if (!userInfo.id || !userInfo.email) {
        setPageFeedback({ type: "error", message: "로그인이 필요합니다." });
        return;
      }

      setPageFeedback(null);
      setIsLoading(true);
      setSelectedPackage(packageInfo);

      try {
        // 결제 요청 생성
        const { orderId, amount } = await beadApi.purchaseBeads(
          packageInfo.quantity,
          packageInfo.price,
        );

        if (!tossClientKey) {
          throw new Error("MISSING_TOSS_CLIENT_KEY");
        }

        // 토스페이먼츠 결제 위젯 초기화
        if (!window.TossPayments) {
          throw new Error("결제 모듈이 아직 로드되지 않았습니다.");
        }
        const tossPayments = window.TossPayments(tossClientKey);

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
        if (
          error instanceof Error &&
          error.message.includes("MISSING_TOSS_CLIENT_KEY")
        ) {
          setPageFeedback({
            type: "error",
            message: "결제 설정이 올바르지 않습니다. 관리자에게 문의해주세요.",
          });
          return;
        }

        setPageFeedback({
          type: "error",
          message: "결제 요청 중 오류가 발생했습니다.",
        });
      } finally {
        setIsLoading(false);
        setSelectedPackage(null);
      }
    },
    [tossClientKey, userInfo.email, userInfo.id],
  );

  const packages = useMemo(() => beadApi.getBeadPackages(), []);

  if (!hasHydrated) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-orange-200 border-t-orange-500" />
          <p className="text-gray-600">로그인 상태를 확인하는 중...</p>
        </div>
      </div>
    );
  }

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

  const getPurchaseButtonClass = (pkg: BeadPackage) => {
    if (isLoading && selectedPackage?.id === pkg.id) {
      return "bg-gray-300 text-gray-500 cursor-not-allowed";
    }
    if (pkg.popular) {
      return "bg-orange-500 hover:bg-orange-600 text-white shadow-lg hover:shadow-xl";
    }
    return "bg-gray-100 hover:bg-orange-100 text-gray-800 hover:text-orange-700";
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <Image
            src="/persimmon_240424.png"
            alt="곶감"
            className="w-20 h-20"
            width={80}
            height={80}
          />
        </div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">곶감 충전</h1>
        <p className="text-gray-600">AI 동화 생성에 필요한 곶감을 충전하세요</p>
      </div>

      {pageFeedback && (
        <div
          className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
            pageFeedback.type === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-green-200 bg-green-50 text-green-700"
          }`}
        >
          {pageFeedback.message}
        </div>
      )}

      {!tossClientKey && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          결제 클라이언트 키가 설정되지 않아 결제를 진행할 수 없습니다.
          <br />
          `NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY` 환경변수를 확인해주세요.
        </div>
      )}

      {/* 현재 곶감 수량 */}
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl p-6 mb-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-2">
          <Image
            src="/persimmon_240424.png"
            alt="곶감"
            className="w-8 h-8"
            width={32}
            height={32}
          />
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
              <Image
                src="/persimmon_240424.png"
                alt="곶감"
                className="w-12 h-12 mr-2"
                width={48}
                height={48}
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
              type="button"
              onClick={() => handlePurchase(pkg)}
              disabled={isLoading}
              className={`w-full py-3 px-4 rounded-xl font-medium transition-all duration-300 ${getPurchaseButtonClass(
                pkg,
              )}`}
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
          type="button"
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

export default function BeadPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4" />
            <p className="text-gray-600">결제 정보를 불러오는 중...</p>
          </div>
        </div>
      }
    >
      <BeadPageContent />
    </Suspense>
  );
}
