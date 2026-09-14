/* eslint-disable @next/next/no-img-element, no-nested-ternary */
// Render branches are mutually exclusive; handlers are direct, unmemoized UI actions.

"use client";

import { useEffect, useRef, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Script from "next/script";

import beadApi from "@/app/api/bead";
import GuideForSign from "@/app/components/GuideForSign";
import { beadPackages } from "@/app/utils/bead-packages";
import useBead from "@/services/hooks/use-bead";
import useUserInfo from "@/services/hooks/use-user-info";

export default function BeadPage() {
  const { userInfo } = useUserInfo();
  const router = useRouter();
  const { bead } = useBead();
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [configStatus, setConfigStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [configRetry, setConfigRetry] = useState(0);
  const operation = useRef(0);
  const purchasing = useRef(false);
  const clientKey = process.env.NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY;
  useEffect(() => {
    operation.current += 1;
    purchasing.current = false;
    setLoading(null);
    setError("");
    return () => {
      operation.current += 1;
    };
  }, [userInfo.id]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (
      params.has("paymentKey") &&
      params.has("orderId") &&
      params.has("amount")
    ) {
      router.replace(`/payment/success?${params.toString()}`);
      return undefined;
    }
    if (params.get("failed") === "true") {
      router.replace("/payment/fail");
      return undefined;
    }
    const controller = new AbortController();
    setConfigStatus("loading");
    setEnabled(false);
    fetch("/api/routes/payment/config", { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error("Configuration unavailable");
        return response.json();
      })
      .then(result => {
        if (controller.signal.aborted) return;
        setEnabled(result.enabled === true);
        setConfigStatus("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setConfigStatus("error");
      });
    return () => controller.abort();
  }, [router, configRetry]);
  async function purchase(pkg: (typeof beadPackages)[number]) {
    if (
      !userInfo.id ||
      !clientKey ||
      !enabled ||
      !ready ||
      !window.TossPayments ||
      purchasing.current
    )
      return;
    const owner = userInfo.id;
    const current = ++operation.current;
    const isCurrent = () =>
      current === operation.current &&
      useUserInfo.getState().userInfo.id === owner;
    purchasing.current = true;
    setLoading(pkg.id);
    setError("");
    try {
      const order = await beadApi.purchaseBeads(
        userInfo.id,
        userInfo.email || "",
        "호담 사용자",
        pkg.quantity,
        pkg.price,
      );
      if (!isCurrent()) return;
      await window.TossPayments(clientKey).requestPayment("카드", {
        amount: order.amount,
        orderId: order.orderId,
        orderName: `곶감 ${pkg.quantity}개`,
        customerName: "호담 사용자",
        customerEmail: userInfo.email || "",
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
      });
    } catch (cause) {
      if (!isCurrent()) return;
      setError(
        cause instanceof Error
          ? cause.message
          : "결제가 중단됐어요. 다시 시도해주세요.",
      );
    } finally {
      if (isCurrent()) {
        purchasing.current = false;
        setLoading(null);
      }
    }
  }
  if (!userInfo.id) return <GuideForSign />;
  return (
    <div className="page-shell">
      {enabled && clientKey && (
        <Script
          src="https://js.tosspayments.com/v1/payment"
          onReady={() => setReady(true)}
          onError={() =>
            setError(
              "결제창을 불러오지 못했어요. 새로고침 후 다시 시도해주세요.",
            )
          }
        />
      )}
      <div className="page-heading">
        <p className="eyebrow">이야기 한 권을 위한 곶감</p>
        <h1>나의 곶감</h1>
        <p>
          8쪽 그림책 한 권에 1개. 결말 선택과 그림에는 추가 곶감이 들지 않아요.
        </p>
      </div>
      <div className="notice-info mb-8 flex items-center gap-4">
        <img src="/persimmon_240424.png" alt="" width="40" height="40" />
        <p>
          보유 곶감{" "}
          <strong className="text-2xl ml-2">
            {bead.count === undefined ? "확인 중" : `${bead.count}개`}
          </strong>
        </p>
      </div>
      {error && (
        <p role="alert" className="notice-error mb-5">
          {error}
        </p>
      )}
      {configStatus === "loading" && (
        <p className="notice-info mb-6" role="status">
          충전 가능 여부를 확인하고 있어요.
        </p>
      )}
      {configStatus === "error" && (
        <div className="notice-error mb-6" role="alert">
          충전 가능 여부를 확인하지 못했어요. 연결을 확인하고 다시 시도해주세요.
          <button
            type="button"
            className="text-link block mt-3"
            onClick={() => setConfigRetry(value => value + 1)}
          >
            다시 확인하기
          </button>
        </div>
      )}
      {configStatus === "ready" && !enabled && (
        <p className="notice-info mb-6">
          곶감 충전은 준비 중이에요. 보유한 곶감으로 그림책을 만들 수 있어요.
        </p>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {beadPackages.map(pkg => (
          <div
            key={pkg.id}
            className="border border-[#dfdfd2] rounded-lg p-5 bg-white"
          >
            <h2 className="text-lg mb-4">곶감 {pkg.quantity}개</h2>
            <p className="text-2xl mb-1">{pkg.price.toLocaleString()}원</p>
            <p className="text-sm text-gray-600 mb-5">
              그림책 {pkg.quantity}권
            </p>
            <button
              className="button-primary w-full"
              type="button"
              disabled={!enabled || !ready || !!loading}
              onClick={() => purchase(pkg)}
            >
              {loading === pkg.id
                ? "처리 중…"
                : configStatus === "loading"
                  ? "확인 중…"
                  : enabled
                    ? ready
                      ? "충전하기"
                      : "결제창 준비 중…"
                    : configStatus === "error"
                      ? "확인 필요"
                      : "준비 중"}
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-5 flex-wrap">
        <Link className="text-link" href="/payment-history">
          결제 내역 보기 →
        </Link>
        <Link className="text-link" href="/service">
          그림책 만들기 →
        </Link>
        <a className="text-link" href="mailto:dldbstls7777@naver.com">
          결제 문의
        </a>
      </div>
    </div>
  );
}
