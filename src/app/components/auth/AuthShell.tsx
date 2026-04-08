import type { ReactNode } from "react";

interface AuthShellProps {
  children: ReactNode;
  containerClassName?: string;
}

export default function AuthShell({
  children,
  containerClassName,
}: AuthShellProps) {
  const containerClasses = ["relative w-full max-w-lg", containerClassName]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="hodam-page-shell relative min-h-screen overflow-hidden px-4 py-8 sm:py-10">
      <div className="pointer-events-none absolute -left-12 top-24 h-56 w-56 rounded-full bg-[#ffe2be]/70 blur-3xl hodam-orb" />
      <div className="pointer-events-none absolute -right-12 bottom-16 h-56 w-56 rounded-full bg-[#ffd7aa]/60 blur-3xl hodam-orb [animation-delay:2s]" />

      <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className={containerClasses}>{children}</div>
      </div>
    </div>
  );
}
