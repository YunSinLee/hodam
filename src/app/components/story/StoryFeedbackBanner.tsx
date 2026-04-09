import FeedbackBanner from "@/app/components/common/FeedbackBanner";

interface StoryFeedbackBannerProps {
  type: "error" | "success";
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function StoryFeedbackBanner({
  type,
  message,
  actionLabel,
  onAction,
}: StoryFeedbackBannerProps) {
  return (
    <FeedbackBanner
      tone={type}
      message={message}
      className="rounded-xl"
      actionLabel={actionLabel}
      onAction={onAction}
    />
  );
}
