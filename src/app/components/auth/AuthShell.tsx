import type { ReactNode } from "react";

interface AuthShellProps {
  children: ReactNode;
  containerClassName?: string;
}

export default function AuthShell({
  children,
  containerClassName,
}: AuthShellProps) {
  const containerClasses = ["relative w-full max-w-md", containerClassName]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 px-4 py-8 sm:py-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-40 -top-44 h-80 w-80 rounded-full bg-gradient-to-br from-orange-200/35 to-amber-200/35 blur-3xl" />
        <div className="absolute -bottom-44 -left-40 h-80 w-80 rounded-full bg-gradient-to-tr from-yellow-200/35 to-orange-200/35 blur-3xl" />
      </div>

      <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className={containerClasses}>{children}</div>
      </div>
    </div>
  );
}
