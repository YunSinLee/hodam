interface BeadPaymentHistoryCardProps {
  onOpenPaymentHistory: () => void;
}

export default function BeadPaymentHistoryCard({
  onOpenPaymentHistory,
}: BeadPaymentHistoryCardProps) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 text-center sm:p-6">
      <h2 className="mb-2 text-xl font-bold text-gray-800">결제 내역</h2>
      <p className="mb-4 text-gray-600">곶감 구매 내역을 확인하세요</p>
      <button
        type="button"
        onClick={onOpenPaymentHistory}
        className="rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-3 text-white transition-all hover:from-purple-600 hover:to-pink-600"
      >
        결제 내역 보기
      </button>
    </section>
  );
}
