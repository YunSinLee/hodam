import type { ReactNode } from "react";

interface LegalPageLayoutProps {
  title: string;
  children: ReactNode;
  footer: ReactNode;
}

export default function LegalPageLayout({
  title,
  children,
  footer,
}: LegalPageLayoutProps) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
        <h1 className="mb-8 text-3xl font-bold text-gray-900">{title}</h1>
        <div className="space-y-8 text-gray-700">{children}</div>
        <div className="mt-12 border-t border-gray-200 pt-8">{footer}</div>
      </div>
    </div>
  );
}
