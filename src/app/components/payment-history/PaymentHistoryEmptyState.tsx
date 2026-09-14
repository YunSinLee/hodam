import type { PaymentHistoryFilter } from "@/lib/ui/payment-history";
import { getPaymentStatusText } from "@/lib/ui/payment-history";

interface PaymentHistoryEmptyStateProps {
  filter: PaymentHistoryFilter;
  onGoBead: () => void;
}

export default function PaymentHistoryEmptyState({
  filter,
  onGoBead,
}: PaymentHistoryEmptyStateProps) {
  return (
    <div className="py-16 text-center">
      <div className="mb-4 text-4xl">💳</div>
      <h3 className="mb-2 text-xl font-semibold text-gray-700">
        {filter === "all"
          ? "결제 내역이 없습니다"
          : `${getPaymentStatusText(filter)} 내역이 없습니다`}
      </h3>
      <p className="mb-6 text-gray-600">
        곶감을 구매하여 호담과 함께 동화를 만들어보세요!
      </p>
      <button
        type="button"
        onClick={onGoBead}
        className="rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-3 text-white transition-all hover:from-purple-600 hover:to-pink-600"
      >
        곶감 구매하기
      </button>
    </div>
  );
}
