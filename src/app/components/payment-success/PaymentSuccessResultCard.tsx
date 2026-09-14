import Image from "next/image";
import Link from "next/link";

import PaymentSuccessCard from "@/app/components/payment-success/PaymentSuccessCard";

interface PaymentSuccessResultInfo {
  orderId: string;
  amount: number;
  paymentFlowId?: string;
}

interface PaymentSuccessResultCardProps {
  paymentInfo: PaymentSuccessResultInfo | null;
}

export default function PaymentSuccessResultCard({
  paymentInfo,
}: PaymentSuccessResultCardProps) {
  const paymentHistoryHref = (() => {
    if (!paymentInfo) return "/payment-history";
    const searchParams = new URLSearchParams({
      orderId: paymentInfo.orderId,
    });
    if (paymentInfo.paymentFlowId) {
      searchParams.set("flowId", paymentInfo.paymentFlowId);
    }
    return `/payment-history?${searchParams.toString()}`;
  })();

  return (
    <PaymentSuccessCard>
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
        <svg
          className="h-8 w-8 text-green-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>

      <h2 className="mb-2 text-2xl font-bold text-gray-800">결제 완료!</h2>
      <p className="mb-6 text-gray-600">
        곶감 충전이 성공적으로 완료되었습니다.
      </p>

      {paymentInfo && (
        <div className="mb-6 rounded-2xl bg-gray-50 p-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">주문번호</span>
              <span className="text-sm font-medium text-gray-800">
                {paymentInfo.orderId}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">결제금액</span>
              <span className="text-lg font-bold text-orange-600">
                {paymentInfo.amount.toLocaleString()}원
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6 flex justify-center">
        <Image
          src="/persimmon_240424.png"
          alt="곶감"
          className="h-12 w-12"
          width={48}
          height={48}
        />
      </div>

      <div className="space-y-3">
        <Link
          href="/service"
          className="block w-full rounded-xl bg-orange-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-orange-600"
        >
          동화 만들러 가기
        </Link>
        <Link
          href={paymentHistoryHref}
          className="block w-full rounded-xl bg-purple-100 px-6 py-3 font-semibold text-purple-700 transition-colors hover:bg-purple-200"
        >
          결제 상세 내역
        </Link>
        <Link
          href="/bead"
          className="block w-full rounded-xl bg-gray-100 px-6 py-3 font-semibold text-gray-700 transition-colors hover:bg-gray-200"
        >
          곶감 충전 페이지
        </Link>
        <Link
          href="/"
          className="block w-full py-2 font-medium text-gray-500 transition-colors hover:text-gray-700"
        >
          홈으로 돌아가기
        </Link>
      </div>
    </PaymentSuccessCard>
  );
}
