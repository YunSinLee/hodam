import type { ReactNode } from "react";

interface PaymentSuccessCardProps {
  children: ReactNode;
  className?: string;
}

export default function PaymentSuccessCard({
  children,
  className = "",
}: PaymentSuccessCardProps) {
  return (
    <div
      className={`rounded-3xl bg-white p-6 text-center shadow-xl sm:p-8 ${className}`.trim()}
    >
      {children}
    </div>
  );
}
