"use client";

import { Suspense, type ReactNode, useEffect, useState } from "react";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import beadApi from "@/lib/client/api/bead";
import useBead from "@/services/hooks/use-bead";

interface PaymentInfo {
  orderId: string;
  amount: number;
  paymentKey: string;
}

interface PaymentStateCardProps {
  title: string;
  description: string;
  tone?: "brand" | "error" | "success";
  children?: ReactNode;
}

function PaymentStateCard({
  title,
  description,
  tone = "brand",
  children,
}: PaymentStateCardProps) {
  const toneClassName = (() => {
    if (tone === "error") return "border-red-200 bg-red-50 text-red-700";
    if (tone === "success")
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    return "border-[#ef8d3d]/20 bg-[#fff8ef] text-[#9f5b20]";
  })();

  return (
    <div className="hodam-page-shell flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <article className="w-full max-w-lg rounded-3xl border border-[#ef8d3d]/20 bg-white/92 p-6 text-center shadow-[0_22px_46px_rgba(181,94,23,0.14)] sm:p-8">
        <div
          className={`mx-auto mb-5 inline-flex min-h-14 min-w-14 items-center justify-center rounded-full border px-3 py-2 text-sm font-bold ${toneClassName}`}
        >
          {title}
        </div>
        <h1 className="hodam-heading text-3xl text-[#2f3338]">{title}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-[#5f6670] sm:text-base">
          {description}
        </p>
        <div className="mt-7 space-y-3">{children}</div>
      </article>
    </div>
  );
}

function PaymentSuccessPageContent() {
  const searchParams = useSearchParams();
  const { setBead } = useBead();

  const [isProcessing, setIsProcessing] = useState(true);
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const processPayment = async () => {
      const paymentKey = searchParams.get("paymentKey");
      const orderId = searchParams.get("orderId");
      const amount = searchParams.get("amount");

      if (!paymentKey || !orderId || !amount) {
        setError("결제 정보가 올바르지 않습니다.");
        setIsProcessing(false);
        return;
      }

      try {
        const parsedAmount = parseInt(amount, 10);
        const updatedBead = await beadApi.completeBeadPurchase(
          paymentKey,
          orderId,
          parsedAmount,
        );

        setBead(updatedBead);
        setPaymentInfo({
          orderId,
          amount: parsedAmount,
          paymentKey,
        });
      } catch (caughtError) {
        if (
          caughtError instanceof Error &&
          caughtError.message &&
          caughtError.message.includes("처리 중")
        ) {
          setError(caughtError.message);
        } else {
          setError("결제 처리 중 오류가 발생했습니다.");
        }
      } finally {
        setIsProcessing(false);
      }
    };

    processPayment();
  }, [searchParams, setBead]);

  if (isProcessing) {
    return (
      <PaymentStateCard
        title="결제 처리 중"
        description="결제 승인 정보를 확인하고 곶감을 충전하고 있습니다. 잠시만 기다려주세요."
      >
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-[#f1c79f] border-t-[#ef8d3d]" />
      </PaymentStateCard>
    );
  }

  if (error) {
    return (
      <PaymentStateCard title="결제 실패" description={error} tone="error">
        <div className="space-y-2">
          <Link
            href="/bead"
            className="hodam-primary-button w-full justify-center text-sm"
          >
            다시 시도하기
          </Link>
          <Link
            href="/"
            className="hodam-outline-button w-full justify-center text-sm"
          >
            홈으로 돌아가기
          </Link>
        </div>
      </PaymentStateCard>
    );
  }

  return (
    <PaymentStateCard
      title="결제 완료"
      description="곶감 충전이 성공적으로 완료되었습니다. 바로 동화를 만들어볼 수 있어요."
      tone="success"
    >
      {paymentInfo && (
        <div className="rounded-2xl border border-[#ef8d3d]/20 bg-[#fff8ef] p-4 text-left text-sm text-[#4b5563]">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-[#5f6670]">주문번호</span>
            <span className="break-all text-right text-xs font-semibold text-[#2f3338] sm:text-sm">
              {paymentInfo.orderId}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="font-semibold text-[#5f6670]">결제금액</span>
            <span className="text-lg font-bold text-[#c56f29]">
              {paymentInfo.amount.toLocaleString()}원
            </span>
          </div>
        </div>
      )}

      <div className="flex justify-center">
        <Image
          src="/persimmon_240424.png"
          alt="곶감"
          className="h-12 w-12"
          width={48}
          height={48}
        />
      </div>

      <div className="space-y-2">
        <Link
          href="/service"
          className="hodam-primary-button w-full justify-center text-sm"
        >
          동화 만들러 가기
        </Link>
        <Link
          href="/bead"
          className="hodam-outline-button w-full justify-center text-sm"
        >
          곶감 충전 페이지
        </Link>
        <Link
          href="/"
          className="inline-flex w-full items-center justify-center py-2 text-sm font-semibold text-[#7a828e] transition hover:text-[#5f6670]"
        >
          홈으로 돌아가기
        </Link>
      </div>
    </PaymentStateCard>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <PaymentStateCard
          title="결제 처리 준비 중"
          description="안전한 결제 확인 절차를 준비하고 있습니다."
        >
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-[#f1c79f] border-t-[#ef8d3d]" />
        </PaymentStateCard>
      }
    >
      <PaymentSuccessPageContent />
    </Suspense>
  );
}
