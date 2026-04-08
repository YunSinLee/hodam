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

        router.replace("/bead");
      } catch (error) {
        const alreadyProcessed =
          (error instanceof Error && error.message.includes("이미 처리된")) ||
          (typeof error === "object" &&
            error !== null &&
            "code" in error &&
            (error as { code?: string }).code === "ALREADY_PROCESSED_PAYMENT");

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
        const { orderId, amount } = await beadApi.purchaseBeads(
          packageInfo.quantity,
          packageInfo.price,
        );

        if (!tossClientKey) {
          throw new Error("MISSING_TOSS_CLIENT_KEY");
        }

        if (!window.TossPayments) {
          throw new Error("결제 모듈이 아직 로드되지 않았습니다.");
        }
        const tossPayments = window.TossPayments(tossClientKey);

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
      <div className="hodam-page-shell px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-3xl rounded-3xl border border-[#ef8d3d]/20 bg-white/90 px-6 py-12 text-center shadow-[0_16px_38px_rgba(181,94,23,0.12)]">
          <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-2 border-[#f0cfad] border-t-[#ef8d3d]" />
          <p className="text-sm text-[#5f6670]">로그인 상태를 확인하는 중...</p>
        </div>
      </div>
    );
  }

  if (!userInfo.id) {
    return (
      <div className="hodam-page-shell px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-3xl rounded-3xl border border-[#ef8d3d]/20 bg-white/90 px-6 py-12 text-center shadow-[0_16px_38px_rgba(181,94,23,0.12)]">
          <h2 className="hodam-heading text-3xl text-[#2f3033]">
            로그인이 필요합니다
          </h2>
          <p className="mt-2 text-sm text-[#5f6670]">
            곶감 충전과 결제 내역 확인은 로그인 후 이용할 수 있습니다.
          </p>
          <button
            type="button"
            onClick={() => router.push("/sign-in")}
            className="hodam-primary-button mt-6 text-sm"
          >
            로그인하러 가기
          </button>
        </div>
      </div>
    );
  }

  const getPurchaseButtonClass = (pkg: BeadPackage) => {
    if (isLoading && selectedPackage?.id === pkg.id) {
      return "cursor-not-allowed bg-[#eadfce] text-[#9a8f81]";
    }

    if (pkg.popular) {
      return "bg-gradient-to-r from-[#ef8d3d] to-[#f3ad52] text-white shadow-[0_12px_24px_rgba(215,120,37,0.35)] hover:-translate-y-0.5 hover:shadow-[0_15px_30px_rgba(215,120,37,0.42)]";
    }

    return "bg-[#fff3e2] text-[#8d5319] hover:bg-[#ffe7c5]";
  };

  return (
    <div className="hodam-page-shell px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <section className="hodam-glass-card p-7 sm:p-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <Image
              src="/persimmon_240424.png"
              alt="곶감"
              className="h-16 w-16"
              width={64}
              height={64}
            />
            <p className="text-xs font-bold uppercase tracking-[0.13em] text-[#ac6020]">
              Bead Center
            </p>
            <h1 className="hodam-heading text-3xl text-[#2e3134] sm:text-4xl">
              곶감 충전
            </h1>
            <p className="max-w-2xl text-sm text-[#5f6670] sm:text-base">
              동화 생성, 번역, 이미지 옵션에 사용하는 곶감을 충전하고 지금 바로
              이어서 만들 수 있습니다.
            </p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-[1.4fr_1fr]">
            <div className="rounded-2xl border border-[#ef8d3d]/20 bg-white/85 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#a86022]">
                현재 잔액
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Image
                  src="/persimmon_240424.png"
                  alt="곶감"
                  className="h-7 w-7"
                  width={28}
                  height={28}
                />
                <span className="text-2xl font-bold text-[#bb671f]">
                  {bead?.count || 0}개
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => router.push("/payment-history")}
              className="rounded-2xl border border-[#ef8d3d]/20 bg-white/85 p-5 text-left transition hover:border-[#ef8d3d]/35 hover:shadow-[0_10px_26px_rgba(181,94,23,0.14)]"
            >
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#a86022]">
                결제 내역
              </p>
              <p className="mt-2 text-sm font-semibold text-[#344153]">
                최근 결제 상태 확인하기
              </p>
              <p className="mt-1 text-xs text-[#6b7280]">
                상세 내역 페이지로 이동
              </p>
            </button>
          </div>
        </section>

        {pageFeedback && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              pageFeedback.type === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-green-200 bg-green-50 text-green-700"
            }`}
          >
            {pageFeedback.message}
          </div>
        )}

        {!tossClientKey && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            결제 클라이언트 키가 설정되지 않아 결제를 진행할 수 없습니다.
            <br />
            `NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY` 환경변수를 확인해주세요.
          </div>
        )}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {packages.map(pkg => (
            <article
              key={pkg.id}
              className={`relative overflow-hidden rounded-3xl border bg-white/90 p-5 shadow-[0_14px_32px_rgba(181,94,23,0.1)] transition ${
                pkg.popular
                  ? "border-[#ef8d3d]/45"
                  : "border-[#ef8d3d]/20 hover:border-[#ef8d3d]/36"
              }`}
            >
              {pkg.popular && (
                <span className="absolute right-3 top-3 rounded-full bg-[#ef8d3d] px-2.5 py-1 text-[11px] font-semibold text-white">
                  인기
                </span>
              )}

              <div className="flex items-center gap-2">
                <Image
                  src="/persimmon_240424.png"
                  alt="곶감"
                  className="h-10 w-10"
                  width={40}
                  height={40}
                />
                <p className="text-xl font-bold text-[#2f3338]">
                  x{pkg.quantity}
                </p>
              </div>

              <div className="mt-4">
                <p className="text-xs text-[#9ca3af] line-through">
                  {pkg.originalPrice.toLocaleString()}원
                </p>
                <p className="mt-1 text-2xl font-bold text-[#cd7129]">
                  {pkg.price.toLocaleString()}원
                </p>
                <p className="mt-1 text-xs font-semibold text-emerald-700">
                  {pkg.discount}% 할인
                </p>
              </div>

              <p className="mt-3 text-sm text-[#68707c]">{pkg.description}</p>

              <button
                type="button"
                onClick={() => handlePurchase(pkg)}
                disabled={isLoading}
                className={`mt-5 flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition ${getPurchaseButtonClass(
                  pkg,
                )}`}
              >
                {isLoading && selectedPackage?.id === pkg.id ? (
                  <>
                    <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-[#8f857a] border-t-transparent" />
                    결제 중...
                  </>
                ) : (
                  "구매하기"
                )}
              </button>
            </article>
          ))}
        </section>

        <section className="rounded-3xl border border-[#ef8d3d]/20 bg-[#fff9ef] p-6">
          <h3 className="text-lg font-bold text-[#2f3238]">곶감 사용 안내</h3>
          <ul className="mt-3 space-y-1.5 text-sm text-[#5f6670]">
            <li>• 동화 생성: 1개</li>
            <li>• 영어 번역 추가: +1개</li>
            <li>• 이미지 생성 추가: +1개</li>
            <li>• 곶감은 환불되지 않으니 신중하게 구매해주세요.</li>
            <li>• 결제 관련 문의: dldbstls7777@naver.com</li>
          </ul>
        </section>
      </div>
    </div>
  );
}

export default function BeadPage() {
  return (
    <Suspense
      fallback={
        <div className="hodam-page-shell px-4 py-14 sm:px-6">
          <div className="mx-auto max-w-3xl rounded-3xl border border-[#ef8d3d]/20 bg-white/90 px-6 py-12 text-center shadow-[0_16px_38px_rgba(181,94,23,0.12)]">
            <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-2 border-[#f0cfad] border-t-[#ef8d3d]" />
            <p className="text-sm text-[#5f6670]">결제 정보를 불러오는 중...</p>
          </div>
        </div>
      }
    >
      <BeadPageContent />
    </Suspense>
  );
}
