import type { PaymentHistory } from "@/lib/client/api/profile";
import { getPaymentStatusMeta } from "@/lib/ui/profile-payment-status";

import ProfileSectionCard from "./ProfileSectionCard";

interface ProfileRecentPaymentsPanelProps {
  paymentHistory: PaymentHistory[];
  formatDate: (dateString: string) => string;
  formatCurrency: (amount: number) => string;
  onGoPaymentHistory: () => void;
  onGoBead: () => void;
}

export default function ProfileRecentPaymentsPanel({
  paymentHistory,
  formatDate,
  formatCurrency,
  onGoPaymentHistory,
  onGoBead,
}: ProfileRecentPaymentsPanelProps) {
  return (
    <ProfileSectionCard
      title="최근 결제 내역"
      actionLabel="전체보기 →"
      onAction={onGoPaymentHistory}
    >
      {paymentHistory.length > 0 ? (
        <div className="space-y-3">
          {paymentHistory.map(payment => {
            const statusMeta = getPaymentStatusMeta(payment.status);

            return (
              <div
                key={payment.id}
                className="flex items-center justify-between rounded-lg bg-gray-50 p-3"
              >
                <div>
                  <h4 className="font-semibold text-gray-800">
                    곶감 {payment.bead_quantity}개
                  </h4>
                  <p className="text-sm text-gray-600">
                    {formatDate(payment.created_at)}
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-800">
                    {formatCurrency(payment.amount)}원
                  </div>
                  <div
                    className={`rounded-full px-2 py-1 text-xs ${statusMeta.badgeClass}`}
                  >
                    {statusMeta.label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-8 text-center text-gray-500">
          <div className="mb-2 text-4xl">💳</div>
          <p>결제 내역이 없습니다.</p>
          <button
            type="button"
            onClick={onGoBead}
            className="mt-2 text-orange-600 hover:text-orange-700"
          >
            곶감 충전하기 →
          </button>
        </div>
      )}
    </ProfileSectionCard>
  );
}
