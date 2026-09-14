import FeedbackBanner from "@/app/components/common/FeedbackBanner";

interface ProfileFeedbackBannerProps {
  type: "error" | "success";
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function ProfileFeedbackBanner({
  type,
  message,
  actionLabel,
  onAction,
}: ProfileFeedbackBannerProps) {
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
