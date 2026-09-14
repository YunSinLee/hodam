interface PaymentTimelineStatusBadgesProps {
  webhookEventCount: number;
  webhookRetryTotal: number;
  eventCount: number;
  hasMissingWebhookWarning: boolean;
  hasWebhookRetryWarning: boolean;
}

export default function PaymentTimelineStatusBadges({
  webhookEventCount,
  webhookRetryTotal,
  eventCount,
  hasMissingWebhookWarning,
  hasWebhookRetryWarning,
}: PaymentTimelineStatusBadgesProps) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
        웹훅 {webhookEventCount}건
      </span>
      <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
        재시도 누적 {webhookRetryTotal}회
      </span>
      <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
        전체 이벤트 {eventCount}건
      </span>
      {hasMissingWebhookWarning && (
        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
          완료 결제인데 웹훅 이벤트 없음
        </span>
      )}
      {hasWebhookRetryWarning && (
        <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-700">
          웹훅 재시도 감지
        </span>
      )}
    </div>
  );
}
