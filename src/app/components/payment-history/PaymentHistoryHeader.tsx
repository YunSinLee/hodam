import type { PaymentHistoryPageHandlers } from "@/app/payment-history/payment-history-contract";

interface PaymentHistoryHeaderProps {
  handlers: Pick<PaymentHistoryPageHandlers, "onBack">;
}

export default function PaymentHistoryHeader({
  handlers,
}: PaymentHistoryHeaderProps) {
  const { onBack } = handlers;

  return (
    <header>
      <div className="mb-4 flex items-center">
        <button
          type="button"
          onClick={onBack}
          className="mr-4 rounded-lg p-2 transition-colors hover:bg-white/50"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-gray-600"
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
        <h1 className="text-2xl font-bold text-gray-800 sm:text-3xl">
          결제 내역
        </h1>
      </div>
      <p className="text-sm text-gray-600 sm:text-base">
        곶감 구매 내역을 확인하세요
      </p>
    </header>
  );
}
