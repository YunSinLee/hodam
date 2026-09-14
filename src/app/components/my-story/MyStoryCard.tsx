import Link from "next/link";

import type { ThreadWithUser } from "@/app/types/openai";
import { formatTime } from "@/app/utils";

interface MyStoryCardProps {
  thread: ThreadWithUser;
  index: number;
}

export default function MyStoryCard({ thread, index }: MyStoryCardProps) {
  return (
    <Link
      href={{
        pathname: `/my-story/${thread.id}`,
        query: {
          ableEnglish: thread.able_english,
        },
      }}
      className="h-full"
    >
      <article
        className="hodam-fade-in-up relative flex h-full cursor-pointer flex-col rounded-xl border border-gray-100 bg-white p-4 shadow-md transition-all duration-300 hover:-translate-y-1 hover:border-orange-200 hover:shadow-xl sm:p-5"
        style={{
          animationDelay: `${index * 0.08}s`,
        }}
      >
        <div className="absolute right-0 top-0 h-24 w-24 overflow-hidden">
          <div
            className={`h-6 w-40 -translate-y-10 translate-x-6 rotate-45 opacity-50 ${thread.has_image ? "bg-green-100" : "bg-gray-50"}`}
          />
        </div>

        <div className="relative z-10 mb-3 flex items-center">
          <div className="mr-3 flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-orange-500 shadow-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
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
            <p className="text-xs text-gray-500">
              {formatTime(thread.created_at, "YYYY년 MM월 DD일")}
            </p>
            <p className="text-sm font-medium text-gray-700 sm:text-base">
              {thread.user?.display_name || "사용자"}
            </p>
          </div>
        </div>

        <h3 className="relative z-10 mb-2 line-clamp-2 text-base font-semibold text-gray-800 sm:text-lg">
          {thread.keywords?.map(keyword => keyword.keyword).join(", ") ||
            "제목 없음"}
        </h3>

        <div className="mt-auto border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2 py-1 text-xs ${thread.able_english ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}
              >
                {thread.able_english ? "영어 가능" : "한국어만"}
              </span>
              <span
                className={`rounded-full px-2 py-1 text-xs ${thread.has_image ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}
              >
                {thread.has_image ? "이미지 있음" : "이미지 없음"}
              </span>
            </div>

            <div className="group rounded-full bg-orange-50 p-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-orange-500 transition-colors group-hover:text-orange-600"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}
