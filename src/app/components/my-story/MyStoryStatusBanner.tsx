import FeedbackBanner from "@/app/components/common/FeedbackBanner";

interface MyStoryStatusBannerProps {
  tone: "error" | "warning";
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function MyStoryStatusBanner({
  tone,
  message,
  actionLabel,
  onAction,
}: MyStoryStatusBannerProps) {
  return (
    <FeedbackBanner
      tone={tone}
      message={message}
      className="mb-5"
      actionLabel={actionLabel}
      onAction={onAction}
    />
  );
}
