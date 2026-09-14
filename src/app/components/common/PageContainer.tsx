import type { ReactNode } from "react";

interface PageContainerProps {
  children: ReactNode;
  width?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const WIDTH_CLASS: Record<NonNullable<PageContainerProps["width"]>, string> = {
  sm: "max-w-2xl",
  md: "max-w-4xl",
  lg: "max-w-screen-lg",
  xl: "max-w-6xl",
};

function joinClassNames(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export default function PageContainer({
  children,
  width = "xl",
  className,
}: PageContainerProps) {
  return (
    <div
      className={joinClassNames(
        "mx-auto w-full px-3 sm:px-4",
        WIDTH_CLASS[width],
        className,
      )}
    >
      {children}
    </div>
  );
}
