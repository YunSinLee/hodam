import type { UserStats } from "@/lib/client/api/profile";

interface ProfileSummaryStatsProps {
  stats: UserStats | null;
  formatCurrency: (amount: number) => string;
}

export default function ProfileSummaryStats({
  stats,
  formatCurrency,
}: ProfileSummaryStatsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
      <div className="rounded-xl bg-white p-5 text-center shadow-lg sm:p-6">
        <div className="mb-2 text-3xl">📚</div>
        <div className="text-2xl font-bold text-orange-600">
          {stats?.totalStories || 0}
        </div>
        <div className="text-sm text-gray-600">생성한 동화</div>
      </div>
      <div className="rounded-xl bg-white p-5 text-center shadow-lg sm:p-6">
        <div className="mb-2 text-3xl">💰</div>
        <div className="text-2xl font-bold text-green-600">
          {formatCurrency(stats?.totalPaymentAmount || 0)}원
        </div>
        <div className="text-sm text-gray-600">총 결제 금액</div>
      </div>
      <div className="rounded-xl bg-white p-5 text-center shadow-lg sm:p-6">
        <div className="mb-2 text-3xl">🍯</div>
        <div className="text-2xl font-bold text-orange-600">
          {stats?.totalBeadsPurchased || 0}
        </div>
        <div className="text-sm text-gray-600">구매한 곶감</div>
      </div>
    </div>
  );
}
