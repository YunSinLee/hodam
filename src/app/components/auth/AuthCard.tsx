import type { ReactNode } from "react";

interface AuthCardProps {
  children: ReactNode;
  className?: string;
}

export default function AuthCard({ children, className }: AuthCardProps) {
  const cardClasses = [
    "rounded-3xl border border-white/40 bg-white/85 p-5 shadow-2xl backdrop-blur-sm sm:p-8",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={cardClasses}>{children}</div>;
}
