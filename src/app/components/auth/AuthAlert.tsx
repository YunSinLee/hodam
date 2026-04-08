import type { ReactNode } from "react";

interface AuthAlertProps {
  children: ReactNode;
  tone?: "error" | "warning" | "neutral";
  className?: string;
}

const TONE_CLASSES: Record<NonNullable<AuthAlertProps["tone"]>, string> = {
  error: "border-red-200 bg-red-50/95 text-red-700",
  warning: "border-[#efc99f] bg-[#fff6ea] text-[#a25a1d]",
  neutral: "border-[#ef8d3d]/20 bg-[#fffaf3] text-[#6b7280]",
};

export default function AuthAlert({
  children,
  tone = "neutral",
  className,
}: AuthAlertProps) {
  const classes = [
    "rounded-2xl border p-3 text-left text-sm leading-relaxed shadow-[0_8px_18px_rgba(146,73,16,0.08)] sm:p-4",
    TONE_CLASSES[tone],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={classes}>{children}</div>;
}
