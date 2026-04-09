interface FeedbackBannerProps {
  tone: "error" | "success" | "warning" | "info";
  message: string;
  className?: string;
  actionLabel?: string;
  onAction?: () => void;
}

const TONE_STYLES = {
  error: "border-red-200 bg-red-50 text-red-700",
  success: "border-green-200 bg-green-50 text-green-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  info: "border-blue-200 bg-blue-50 text-blue-700",
} as const;

const ACTION_STYLES = {
  error:
    "border-red-300 bg-white text-red-700 hover:bg-red-50 focus-visible:ring-red-300",
  success:
    "border-green-300 bg-white text-green-700 hover:bg-green-50 focus-visible:ring-green-300",
  warning:
    "border-amber-300 bg-white text-amber-800 hover:bg-amber-50 focus-visible:ring-amber-300",
  info: "border-blue-300 bg-white text-blue-700 hover:bg-blue-50 focus-visible:ring-blue-300",
} as const;

export default function FeedbackBanner({
  tone,
  message,
  className = "",
  actionLabel,
  onAction,
}: FeedbackBannerProps) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm ${TONE_STYLES[tone]} ${className}`.trim()}
    >
      <p>{message}</p>
      {actionLabel && onAction && (
        <div className="mt-2">
          <button
            type="button"
            onClick={onAction}
            className={`rounded border px-3 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 ${ACTION_STYLES[tone]}`}
          >
            {actionLabel}
          </button>
        </div>
      )}
    </div>
  );
}
