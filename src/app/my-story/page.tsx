"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import threadApi from "@/app/api/thread";
import type { ThreadWithUser } from "@/app/types/openai";
import { formatTime } from "@/app/utils";
import useUserInfo from "@/services/hooks/use-user-info";

export default function MyStory() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [threads, setThreads] = useState<ThreadWithUser[]>([]);
  const { userInfo } = useUserInfo();
  const [isPageLoaded, setIsPageLoaded] = useState(false);

  async function fetchAllThreads() {
    setIsLoading(true);
    const threads = await threadApi.fetchAllThreads();
    setThreads(threads);
    setIsLoading(false);
  }

  async function fetchThreadsByUserId() {
    if (!userInfo.id) return;
    setIsLoading(true);
    const threads = await threadApi.fetchThreadsByUserId({
      user_id: userInfo.id,
    });
    setThreads(threads);
    setIsLoading(false);
  }

  useEffect(() => {
    fetchAllThreads();
    // 페이지 로드 애니메이션을 위한 타이머
    const timer = setTimeout(() => {
      setIsPageLoaded(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    fetchThreadsByUserId();
  }, [userInfo.id]);

  return (
    <div
      className={`max-w-screen-lg mx-auto px-4 py-8 min-h-screen transition-opacity duration-500 ${isPageLoaded ? "opacity-100" : "opacity-0"}`}
    >
      <div className="mb-8 border-b pb-4">
        <h1 className="text-3xl font-bold text-orange-600 mb-2 relative">
          내 동화
          <span className="absolute bottom-0 left-0 w-1/3 h-1 bg-orange-400 rounded-full transform translate-y-2" />
        </h1>
        <p className="text-gray-600">내가 만든 동화 목록을 확인해보세요</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, index) => (
            <div
              key={index}
              className="bg-white rounded-lg shadow-md p-5 border border-gray-100 animate-pulse"
              style={{
                animation: `pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite`,
                animationDelay: `${index * 0.1}s`,
              }}
            >
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-4" />
              <div className="h-3 bg-gray-200 rounded w-1/2 mb-3" />
              <div className="h-3 bg-gray-200 rounded w-full mb-3" />
              <div className="flex justify-between mt-5">
                <div className="h-8 bg-gray-200 rounded w-1/4" />
                <div className="h-8 bg-gray-200 rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : threads.length === 0 ? (
        <div className="text-center py-16 bg-gradient-to-b from-orange-50 to-white rounded-lg border border-orange-100 shadow-sm transform transition-all duration-300 hover:scale-[1.01] hover:shadow-md">
          <div className="flex justify-center mb-6">
            <div className="relative w-32 h-32">
              <div
                className="absolute inset-0 bg-orange-100 rounded-full opacity-50 animate-ping"
                style={{ animationDuration: "3s" }}
              />
              <div className="relative flex items-center justify-center w-full h-full bg-orange-50 rounded-full">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-16 w-16 text-orange-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </div>
            </div>
          </div>
          <h2 className="text-2xl font-semibold text-gray-700 mb-3">
            아직 만든 동화가 없어요
          </h2>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            새로운 동화를 만들어 호담과 함께 창의적인 이야기를 만들어보세요!
          </p>
          <Link
            href="/service"
            className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-full hover:from-orange-600 hover:to-orange-700 transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-1"
          >
            <span className="font-medium">새 동화 만들기</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 ml-2"
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {threads.map((thread: ThreadWithUser, index) => (
            <Link
              key={thread.id}
              href={{
                pathname: `/my-story/${thread.id}`,
                query: {
                  ableEnglish: thread.able_english,
                },
              }}
            >
              <div
                className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-300 p-5 border border-gray-100 h-full flex flex-col cursor-pointer transform hover:-translate-y-1 hover:border-orange-200"
                style={{
                  animation: `fadeInUp 0.5s ease-out forwards`,
                  animationDelay: `${index * 0.1}s`,
                }}
              >
                <div className="absolute top-0 right-0 w-24 h-24 overflow-hidden">
                  <div
                    className={`w-40 transform rotate-45 translate-x-6 -translate-y-10 ${thread.has_image ? "bg-green-100" : "bg-gray-50"} h-6 opacity-50`}
                  />
                </div>

                <div className="flex items-center mb-3 relative z-10">
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-500 mr-3 shadow-sm">
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
                    <p className="font-medium">
                      {thread.user?.display_name || "사용자"}
                    </p>
                  </div>
                </div>

                <h3 className="text-lg font-semibold mb-2 text-gray-800 line-clamp-2 relative z-10">
                  {thread.keywords
                    ?.map(keyword => keyword.keyword)
                    .join(", ") || "제목 없음"}
                </h3>

                <div className="mt-auto pt-4 border-t border-gray-100">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center flex-wrap gap-2">
                      <div
                        className={`px-2 py-1 rounded-full text-xs ${thread.able_english ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}
                      >
                        {thread.able_english ? "영어 가능" : "한국어만"}
                      </div>

                      <div
                        className={`px-2 py-1 rounded-full text-xs ${thread.has_image ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}
                      >
                        {thread.has_image ? "이미지 있음" : "이미지 없음"}
                      </div>
                    </div>

                    <div className="bg-orange-50 rounded-full p-1 group">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 text-orange-500 group-hover:text-orange-600 transition-colors"
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
              </div>
            </Link>
          ))}
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
