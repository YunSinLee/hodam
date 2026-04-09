import Link from "next/link";

import type { MyStoryDetailEmptyStateProps } from "@/app/components/my-story-detail/my-story-detail-contract";

export default function MyStoryDetailEmptyState({
  errorMessage,
  onRetry,
}: MyStoryDetailEmptyStateProps) {
  return (
    <div className="py-16 text-center">
      <div className="mb-6 flex justify-center">
        <div className="relative h-24 w-24">
          <div className="absolute inset-0 animate-pulse rounded-full bg-gray-100 opacity-50" />
          <div className="relative flex h-full w-full items-center justify-center rounded-full bg-gray-50">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.29-1.009-5.824-2.562M15 6.306a7.962 7.962 0 00-6 0m6 0V5a2 2 0 00-2-2H9a2 2 0 00-2 2v1.306m8 0V7a2 2 0 012 2v10a2 2 0 01-2 2H7a2 2 0 01-2-2V9a2 2 0 012-2h8a2 2 0 012 2v1.306z"
              />
            </svg>
          </div>
        </div>
      </div>
      <h2 className="mb-2 text-xl font-semibold text-gray-700">
        {errorMessage
          ? "동화 상세를 불러오지 못했어요"
          : "동화를 찾을 수 없어요"}
      </h2>
      <p className="mb-6 text-gray-600">
        {errorMessage ||
          "이 동화의 내용이 아직 생성되지 않았거나 문제가 발생했습니다."}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {errorMessage && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center rounded-lg border border-orange-300 px-4 py-2 text-orange-700 transition duration-200 hover:bg-orange-50"
          >
            다시 시도
          </button>
        )}
        <Link
          href="/service"
          className="inline-flex items-center rounded-lg bg-orange-500 px-4 py-2 text-white transition duration-200 hover:bg-orange-600"
        >
          <span>새 동화 만들기</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="ml-2 h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </Link>
      </div>
    </div>
  );
}
