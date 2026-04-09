import type {
  PaymentHistoryFormatters,
  PaymentHistoryStatsState,
} from "@/app/payment-history/payment-history-contract";

interface PaymentHistoryStatsProps {
  state: PaymentHistoryStatsState;
  formatters: Pick<PaymentHistoryFormatters, "formatCurrency">;
}

export default function PaymentHistoryStats({
  state,
  formatters,
}: PaymentHistoryStatsProps) {
  const { totalAmount, totalBeads, totalCount } = state;
  const { formatCurrency } = formatters;

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
      <div className="rounded-xl bg-white p-5 text-center shadow-lg sm:p-6">
        <div className="mb-2 text-3xl">💰</div>
        <div className="text-2xl font-bold text-green-600">
          {formatCurrency(totalAmount)}원
        </div>
        <div className="text-sm text-gray-600">총 결제 금액</div>
      </div>
      <div className="rounded-xl bg-white p-5 text-center shadow-lg sm:p-6">
        <div className="mb-2 text-3xl">🍯</div>
        <div className="text-2xl font-bold text-orange-600">{totalBeads}개</div>
        <div className="text-sm text-gray-600">총 구매 곶감</div>
      </div>
      <div className="rounded-xl bg-white p-5 text-center shadow-lg sm:p-6">
        <div className="mb-2 text-3xl">📊</div>
        <div className="text-2xl font-bold text-purple-600">{totalCount}건</div>
        <div className="text-sm text-gray-600">총 결제 건수</div>
      </div>
    </section>
  );
}
