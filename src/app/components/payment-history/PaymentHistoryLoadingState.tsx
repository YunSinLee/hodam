export default function PaymentHistoryLoadingState() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-purple-600" />
        <p className="text-gray-600">결제 내역을 불러오는 중...</p>
      </div>
    </div>
  );
}
