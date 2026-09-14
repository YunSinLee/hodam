import type { ReactNode } from "react";

interface PaymentSuccessShellProps {
  tone: "success" | "error";
  children: ReactNode;
}

const TONE_BACKGROUND_CLASS = {
  success: "bg-gradient-to-br from-green-50 to-emerald-50",
  error: "bg-gradient-to-br from-red-50 to-pink-50",
} as const;

export default function PaymentSuccessShell({
  tone,
  children,
}: PaymentSuccessShellProps) {
  return (
    <div
      className={`flex min-h-screen items-center justify-center ${TONE_BACKGROUND_CLASS[tone]}`}
    >
      <div className="w-full max-w-md px-4 py-8 sm:py-10">{children}</div>
    </div>
  );
}
