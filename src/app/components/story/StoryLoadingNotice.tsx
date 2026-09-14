interface StoryLoadingNoticeProps {
  title: string;
  description?: string;
  tone?: "orange" | "blue";
  className?: string;
}

const TONE_STYLES = {
  orange: {
    container: "border-orange-200 bg-orange-50",
    title: "text-orange-700",
    description: "text-orange-600",
    spinner: "border-orange-500 border-t-transparent",
  },
  blue: {
    container: "border-blue-200 bg-blue-50",
    title: "text-blue-700",
    description: "text-blue-600",
    spinner: "border-blue-500 border-t-transparent",
  },
} as const;

export default function StoryLoadingNotice({
  title,
  description,
  tone = "orange",
  className,
}: StoryLoadingNoticeProps) {
  const style = TONE_STYLES[tone];
  const containerClasses = ["rounded-xl border p-4", style.container, className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={containerClasses}>
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 h-6 w-6 animate-spin rounded-full border-2 ${style.spinner}`}
        />
        <div>
          <p className={`font-medium ${style.title}`}>{title}</p>
          {description && (
            <p className={`mt-1 text-sm ${style.description}`}>{description}</p>
          )}
        </div>
      </div>
    </div>
  );
}
