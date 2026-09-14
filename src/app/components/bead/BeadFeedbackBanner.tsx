import FeedbackBanner from "@/app/components/common/FeedbackBanner";

interface BeadFeedbackBannerProps {
  type: "error" | "success";
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function BeadFeedbackBanner({
  type,
  message,
  actionLabel,
  onAction,
}: BeadFeedbackBannerProps) {
  return (
    <FeedbackBanner
      tone={type}
      message={message}
      className="mb-6"
      actionLabel={actionLabel}
      onAction={onAction}
    />
  );
}
