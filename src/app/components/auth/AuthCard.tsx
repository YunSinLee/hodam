import type { ReactNode } from "react";

interface AuthCardProps {
  children: ReactNode;
  className?: string;
}

export default function AuthCard({ children, className }: AuthCardProps) {
  const cardClasses = [
    "hodam-glass-card rounded-[28px] p-6 shadow-[0_24px_52px_rgba(146,73,16,0.16)] sm:p-8",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={cardClasses}>{children}</div>;
}
