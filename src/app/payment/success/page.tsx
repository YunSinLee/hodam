"use client";

import { useEffect, useRef, useState } from "react";

import Link from "next/link";

import beadApi from "@/app/api/bead";
import GuideForSign from "@/app/components/GuideForSign";
import useBead from "@/services/hooks/use-bead";
import useUserInfo from "@/services/hooks/use-user-info";

export default function PaymentSuccessPage() {
  const { userInfo, isAuthReady } = useUserInfo();
  const { setBead } = useBead();
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const attempt = useRef<Promise<unknown> | null>(null);
  const attemptOwner = useRef<string>();
  useEffect(() => {
    if (!isAuthReady || !userInfo.id) return undefined;
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const paymentKey = params.get("paymentKey");
    const orderId = params.get("orderId");
    const amount = Number(params.get("amount"));
    if (
      !paymentKey ||
      !orderId ||
      !Number.isSafeInteger(amount) ||
      amount <= 0
    ) {
      setError("결제 정보가 없거나 올바르지 않아요. 결제 내역을 확인해주세요.");
      setStatus("error");
      return undefined;
    }
    setStatus("loading");
    if (attemptOwner.current !== userInfo.id) {
      attempt.current = null;
      attemptOwner.current = userInfo.id;
    }
    attempt.current ||= beadApi.completeBeadPurchase(
      paymentKey,
      orderId,
      amount,
      userInfo.id,
    );
    attempt.current
      .then(value => {
        if (active) {
          setBead(
            value as Awaited<ReturnType<typeof beadApi.completeBeadPurchase>>,
          );
          setStatus("complete");
        }
      })
      .catch(cause => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "결제 상태를 확인하지 못했어요.",
          );
          setStatus("error");
        }
      });
    return () => {
      active = false;
    };
  }, [userInfo.id, isAuthReady, retry, setBead]);
  if (!userInfo.id) return <GuideForSign />;
  return (
    <div className="auth-page">
      <h1>
        {status === "complete"
          ? "곶감이 도착했어요"
          : status === "error"
            ? "결제 상태를 확인해주세요"
            : "결제를 확인하고 있어요"}
      </h1>
      <p role={status === "error" ? "alert" : "status"}>
        {status === "complete"
          ? "내 곶감에 충전 수량을 반영했어요."
          : status === "error"
            ? error
            : "승인과 곶감 지급을 확인할 때까지 기다려주세요."}
      </p>
      {status === "error" && (
        <button
          type="button"
          className="button-primary"
          onClick={() => {
            attempt.current = null;
            setRetry(value => value + 1);
          }}
        >
          결제 상태 다시 확인
        </button>
      )}
      {status === "complete" && (
        <Link href="/service" className="button-primary">
          그림책 만들기
        </Link>
      )}
      <Link className="text-link block mt-5" href="/payment-history">
        결제 내역 보기
      </Link>
    </div>
  );
}
