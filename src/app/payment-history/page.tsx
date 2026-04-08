"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import { recoverSessionUserInfo } from "@/lib/auth/session-recovery";
import { buildSignInRedirectPath } from "@/lib/auth/sign-in-redirect";
import paymentApi, { PaymentHistory } from "@/lib/client/api/payment";
import { resolveProtectedPageErrorState } from "@/lib/ui/protected-page-error";
import useUserInfo from "@/services/hooks/use-user-info";

const FILTER_ITEMS = [
  { key: "all", label: "전체" },
  { key: "completed", label: "완료" },
  { key: "pending", label: "대기" },
  { key: "failed", label: "실패" },
  { key: "cancelled", label: "취소" },
] as const;

export default function PaymentHistoryPage() {
  const router = useRouter();
  const { userInfo, setUserInfo } = useUserInfo();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [payments, setPayments] = useState<PaymentHistory[]>([]);
  const [filter, setFilter] = useState<string>("all");
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
        return "bg-emerald-100 text-emerald-700";
      case "pending":
        return "bg-amber-100 text-amber-700";
      case "failed":
        return "bg-red-100 text-red-700";
      case "cancelled":
        return "bg-zinc-100 text-zinc-700";
      default:
        return "bg-zinc-100 text-zinc-700";
    }
  };

  const filteredPayments = useMemo(
    () =>
      payments.filter(payment => {
        if (filter === "all") return true;
        return payment.status === filter;
      }),
    [filter, payments],
  );

  const totalAmount = payments
    .filter(p => p.status === "completed")
    .reduce((sum, p) => sum + p.amount, 0);

  const totalBeads = payments
    .filter(p => p.status === "completed")
    .reduce((sum, p) => sum + p.bead_quantity, 0);

  if (isLoading || !isAuthReady) {
    return (
      <div className="hodam-page-shell px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl rounded-3xl border border-[#ef8d3d]/20 bg-white/90 px-6 py-12 text-center shadow-[0_16px_38px_rgba(181,94,23,0.12)]">
          <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-2 border-[#f0cfad] border-t-[#ef8d3d]" />
          <p className="text-sm text-[#5f6670]">결제 내역을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="hodam-page-shell px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="hodam-glass-card p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#ef8d3d]/25 bg-white text-[#a56024] transition hover:bg-[#fff4e6]"
              aria-label="뒤로 가기"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
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

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#ad6220]">
                Billing
              </p>
              <h1 className="hodam-heading mt-1 text-3xl text-[#2e3134] sm:text-4xl">
                결제 내역
              </h1>
              <p className="mt-1 text-sm text-[#5f6670] sm:text-base">
                곶감 구매 내역과 결제 상태를 한눈에 확인하세요.
              </p>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <article className="hodam-soft-card p-5">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#9e5d22]">
              총 결제 금액
            </p>
            <p className="mt-2 text-2xl font-bold text-emerald-700">
              {formatCurrency(totalAmount)}원
            </p>
          </article>
          <article className="hodam-soft-card p-5">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#9e5d22]">
              총 구매 곶감
            </p>
            <p className="mt-2 text-2xl font-bold text-[#cf762f]">
              {totalBeads}개
            </p>
          </article>
          <article className="hodam-soft-card p-5">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#9e5d22]">
              총 결제 건수
            </p>
            <p className="mt-2 text-2xl font-bold text-[#364152]">
              {payments.length}건
            </p>
          </article>
        </section>

        <section className="hodam-soft-card p-5">
          <div className="flex flex-wrap gap-2">
            {FILTER_ITEMS.map(({ key, label }) => (
              <button
                type="button"
                key={key}
                onClick={() => setFilter(key)}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition sm:text-sm ${
                  filter === key
                    ? "bg-[#ef8d3d] text-white shadow-[0_8px_18px_rgba(215,120,37,0.32)]"
                    : "bg-[#fff2e1] text-[#8a531d] hover:bg-[#ffe7c6]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {errorMessage && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
            {shouldRedirectToSignIn && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() =>
                    router.replace(buildSignInRedirectPath("/payment-history"))
                  }
                  className="rounded-full border border-red-300 bg-white px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                >
                  다시 로그인
                </button>
              </div>
            )}
          </div>
        )}

        <section className="overflow-hidden rounded-3xl border border-[#ef8d3d]/20 bg-white/90 shadow-[0_16px_34px_rgba(181,94,23,0.1)]">
          {filteredPayments.length > 0 ? (
            <div className="divide-y divide-[#f4e6d4]">
              {filteredPayments.map(payment => (
                <article
                  key={payment.id}
                  className="p-5 transition hover:bg-[#fff9f0] sm:p-6"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-[#2f3338]">
                          곶감 {payment.bead_quantity}개
                        </h3>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusColor(
                            payment.status,
                          )}`}
                        >
                          {getStatusText(payment.status)}
                        </span>
                      </div>

                      <dl className="mt-2 space-y-1 text-xs text-[#6b7280] sm:text-sm">
                        <div>
                          <dt className="inline font-medium text-[#5f6670]">
                            주문번호
                          </dt>
                          <dd className="ml-2 inline">{payment.order_id}</dd>
                        </div>
                        {payment.payment_key && (
                          <div>
                            <dt className="inline font-medium text-[#5f6670]">
                              결제키
                            </dt>
                            <dd className="ml-2 inline break-all">
                              {payment.payment_key}
                            </dd>
                          </div>
                        )}
                        <div>
                          <dt className="inline font-medium text-[#5f6670]">
                            결제일
                          </dt>
                          <dd className="ml-2 inline">
                            {formatDate(payment.created_at)}
                          </dd>
                        </div>
                        {payment.completed_at && (
                          <div>
                            <dt className="inline font-medium text-[#5f6670]">
                              완료일
                            </dt>
                            <dd className="ml-2 inline">
                              {formatDate(payment.completed_at)}
                            </dd>
                          </div>
                        )}
                      </dl>
                    </div>

                    <div className="sm:text-right">
                      <p className="text-2xl font-bold text-[#2f3338]">
                        {formatCurrency(payment.amount)}원
                      </p>
                      <p className="text-xs text-[#6b7280] sm:text-sm">
                        개당{" "}
                        {formatCurrency(
                          Math.round(payment.amount / payment.bead_quantity),
                        )}
                        원
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="px-6 py-14 text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[#fff2e1] text-3xl">
                💳
              </div>
              <h3 className="text-xl font-bold text-[#2f3338]">
                {filter === "all"
                  ? "결제 내역이 없습니다"
                  : `${getStatusText(filter)} 내역이 없습니다`}
              </h3>
              <p className="mt-2 text-sm text-[#5f6670] sm:text-base">
                곶감을 구매하면 생성 이력을 여기서 확인할 수 있어요.
              </p>
              <button
                type="button"
                onClick={() => router.push("/bead")}
                className="hodam-primary-button mt-6 text-sm"
              >
                곶감 구매하기
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
