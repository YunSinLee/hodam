import Link from "next/link";

import PaymentSuccessCard from "@/app/components/payment-success/PaymentSuccessCard";

interface PaymentSuccessErrorCardProps {
  message: string;
}

export default function PaymentSuccessErrorCard({
  message,
}: PaymentSuccessErrorCardProps) {
  return (
    <PaymentSuccessCard>
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
        <svg
          className="h-8 w-8 text-red-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </div>
      <h2 className="mb-4 text-2xl font-bold text-gray-800">결제 실패</h2>
      <p className="mb-6 text-gray-600">{message}</p>
      <div className="space-y-3">
        <Link
          href="/bead"
          className="block w-full rounded-xl bg-orange-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-orange-600"
        >
          다시 시도하기
        </Link>
        <Link
          href="/"
          className="block w-full rounded-xl bg-gray-100 px-6 py-3 font-semibold text-gray-700 transition-colors hover:bg-gray-200"
        >
          홈으로 돌아가기
        </Link>
      </div>
    </PaymentSuccessCard>
  );
}
