import Link from "next/link";

import type { MyStoryDetailHeaderProps } from "@/app/components/my-story-detail/my-story-detail-contract";

export default function MyStoryDetailHeader({
  threadId,
  ableEnglish,
  isShowEnglish,
  onToggleEnglish,
}: MyStoryDetailHeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-orange-100 bg-white shadow-sm">
      <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Link href="/my-story" className="group">
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 transition-all duration-200 hover:border-orange-300 hover:bg-orange-50">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 text-gray-600 transition-colors group-hover:text-orange-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                <span className="text-sm font-medium text-gray-700 group-hover:text-orange-700">
                  목록으로
                </span>
              </div>
            </Link>

            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-orange-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-800 sm:text-xl">
                  동화 이야기
                </h1>
                <p className="text-xs text-gray-500">ID: {threadId}</p>
              </div>
            </div>
          </div>

          {ableEnglish && (
            <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 text-blue-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
                />
              </svg>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={isShowEnglish}
                  onChange={onToggleEnglish}
                  className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-blue-700">
                  영어 보기
                </span>
              </label>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
