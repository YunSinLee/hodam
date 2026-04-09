import type { ReactNode } from "react";

interface ProfileSectionCardProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
}

export default function ProfileSectionCard({
  title,
  subtitle,
  actionLabel,
  onAction,
  children,
}: ProfileSectionCardProps) {
  const showAction = Boolean(actionLabel && onAction);
  let headerRight: ReactNode = null;

  if (showAction) {
    headerRight = (
      <button
        type="button"
        onClick={onAction}
        className="shrink-0 text-sm text-orange-600 hover:text-orange-700"
      >
        {actionLabel}
      </button>
    );
  } else if (subtitle) {
    headerRight = <span className="text-xs text-gray-500">{subtitle}</span>;
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-lg sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-gray-800">{title}</h3>
        {headerRight}
      </div>
      {children}
    </section>
  );
}
