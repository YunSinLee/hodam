"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import paymentApi, { PaymentHistory } from "@/app/api/payment";
import GuideForSign from "@/app/components/GuideForSign";
import useUserInfo from "@/services/hooks/use-user-info";

const statuses = {
  all: "전체",
  completed: "완료",
  pending: "확인 중",
  failed: "실패",
  cancelled: "취소",
};
export default function PaymentHistoryPage() {
  const { userInfo } = useUserInfo();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentHistory[]>([]);
  const [filter, setFilter] = useState<keyof typeof statuses>("all");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!userInfo.id) return undefined;
    let active = true;
    setLoading(true);
    setError("");
    setPayments([]);
    paymentApi
      .getPaymentHistory(userInfo.id)
      .then(value => {
        if (active) setPayments(value);
      })
      .catch(() => {
        if (active)
          setError(
            "결제 내역을 불러오지 못했어요. 연결을 확인하고 다시 시도해주세요.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userInfo.id, retry]);
  const filtered = payments.filter(
    item => filter === "all" || item.status === filter,
  );
  const completed = payments.filter(item => item.status === "completed");
  if (!userInfo.id) return <GuideForSign />;
  return (
    <div className="page-shell max-w-4xl">
      <div className="page-heading">
        <p className="eyebrow">나의 호담</p>
        <h1>결제 내역</h1>
        <p>주문 상태와 충전한 곶감을 확인해요.</p>
      </div>
      {loading && (
        <p role="status" className="empty-state">
          결제 내역을 불러오고 있어요.
        </p>
      )}
      {error && (
        <div role="alert" className="notice-error">
          {error}
          <button
            type="button"
            className="text-link block mt-3"
            onClick={() => setRetry(value => value + 1)}
          >
            다시 불러오기
          </button>
        </div>
      )}
      {!loading && !error && (
        <>
          <p className="notice-info mb-6">
            완료된 결제 {completed.length}건 ·{" "}
            {completed
              .reduce((sum, item) => sum + item.amount, 0)
              .toLocaleString("ko-KR")}
            원 · 곶감{" "}
            {completed
              .reduce((sum, item) => sum + item.bead_quantity, 0)
              .toLocaleString("ko-KR")}
            개
          </p>
          <div
            className="flex gap-2 flex-wrap mb-6"
            role="group"
            aria-label="결제 상태 필터"
          >
            {Object.entries(statuses).map(([key, label]) => (
              <button
                type="button"
                key={key}
                className={
                  key === filter ? "button-primary" : "button-secondary"
                }
                aria-pressed={key === filter}
                onClick={() => setFilter(key as keyof typeof statuses)}
              >
                {label}
              </button>
            ))}
          </div>
          {filtered.length ? (
            // Keep list semantics when the browser hides decorative list markers.
            // eslint-disable-next-line jsx-a11y/no-redundant-roles
            <ul className="payment-list" role="list">
              {filtered.map(payment => (
                <li key={payment.id} className="account-panel">
                  <div className="flex justify-between gap-4">
                    <h2 className="text-lg">곶감 {payment.bead_quantity}개</h2>
                    <strong>{payment.amount.toLocaleString("ko-KR")}원</strong>
                  </div>
                  <p className="mt-3 text-sm">
                    {statuses[payment.status]} ·{" "}
                    {new Date(payment.created_at).toLocaleString("ko-KR")}
                  </p>
                  <p className="mt-2 text-xs text-gray-500 break-all">
                    주문번호 {payment.order_id}
                  </p>
                  {payment.status === "pending" && (
                    <p className="mt-3 text-sm text-gray-600">
                      결제를 마쳤는데 확인 중으로 남아 있다면, 결제 완료
                      화면에서 다시 확인하거나 주문번호와 함께 문의해주세요.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state">
              <h2>
                {filter === "all"
                  ? "아직 결제 내역이 없어요"
                  : `${statuses[filter]} 상태의 주문이 없어요`}
              </h2>
              <Link className="text-link inline-block mt-4" href="/bead">
                곶감 충전 살펴보기 →
              </Link>
            </div>
          )}
        </>
      )}
      <Link className="text-link inline-block mt-8" href="/profile">
        내 계정으로 돌아가기
      </Link>
    </div>
  );
}
