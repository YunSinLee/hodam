import FeedbackBanner from "@/app/components/common/FeedbackBanner";

interface BeadWarningBannerProps {
  message: string;
}

export default function BeadWarningBanner({ message }: BeadWarningBannerProps) {
  return <FeedbackBanner tone="warning" message={message} className="mb-6" />;
}
