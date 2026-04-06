import type { ReactNode } from "react";

interface AuthAlertProps {
  children: ReactNode;
  tone?: "error" | "warning" | "neutral";
  className?: string;
}

const TONE_CLASSES: Record<NonNullable<AuthAlertProps["tone"]>, string> = {
  error: "border-red-200 bg-red-50 text-red-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  neutral: "border-gray-200 bg-gray-50 text-gray-600",
};

export default function AuthAlert({
  children,
  tone = "neutral",
  className,
}: AuthAlertProps) {
  const classes = [
    "rounded-2xl border p-3 text-left text-sm leading-relaxed sm:p-4",
    TONE_CLASSES[tone],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={classes}>{children}</div>;
}
