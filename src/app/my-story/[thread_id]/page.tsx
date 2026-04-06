"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import MessageDisplay from "@/app/components/MessageDisplay";
import type { Thread } from "@/app/types/openai";
import { buildSignInRedirectPath } from "@/lib/auth/sign-in-redirect";
import threadApi, { type ThreadDiagnostics } from "@/lib/client/api/thread";
import { resolveThreadDetailErrorState } from "@/lib/ui/thread-detail-error";

export default function MyStoryDetail() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [thread, setThread] = useState<Thread>({} as Thread);
  const [messages, setMessages] = useState<{ text: string; text_en: string }[]>(
    [],
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isShowEnglish, setIsShowEnglish] = useState<boolean>(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [detailDiagnostics, setDetailDiagnostics] =
    useState<ThreadDiagnostics | null>(null);
  const [isPageLoaded, setIsPageLoaded] = useState(false);
  const params = useParams();
  const router = useRouter();
  const signInRedirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const threadId = Number(params?.thread_id);

  const fetchThreadDetail = useCallback(async () => {
    if (signInRedirectTimerRef.current) {
      clearTimeout(signInRedirectTimerRef.current);
      signInRedirectTimerRef.current = null;
    }

    if (!Number.isFinite(threadId) || threadId <= 0) {
      setThread({} as Thread);
      setMessages([]);
      setImageUrl(null);
      setDetailDiagnostics(null);
      setErrorMessage("잘못된 동화 ID입니다.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const { detail, diagnostics } =
        await threadApi.getThreadDetailWithDiagnostics(threadId);

      setThread(detail.thread);
      setImageUrl(detail.imageUrl);
      setDetailDiagnostics(diagnostics);
      setMessages(
        detail.messages.map(item => ({
          text: item.text,
          text_en: item.text_en,
        })),
      );
    } catch (error) {
      const errorState = resolveThreadDetailErrorState(error);
      setThread({} as Thread);
      setMessages([]);
      setImageUrl(null);
      setDetailDiagnostics(null);
      setErrorMessage(errorState.message);

      if (errorState.shouldRedirectToSignIn) {
        signInRedirectTimerRef.current = setTimeout(() => {
          const nextPath = `/my-story/${threadId}`;
          router.replace(buildSignInRedirectPath(nextPath));
        }, 800);
      }
    } finally {
      setIsLoading(false);
    }
  }, [router, threadId]);

  useEffect(() => {
    fetchThreadDetail();

    const timer = setTimeout(() => {
      setIsPageLoaded(true);
    }, 100);
    return () => {
      clearTimeout(timer);
      if (signInRedirectTimerRef.current) {
        clearTimeout(signInRedirectTimerRef.current);
        signInRedirectTimerRef.current = null;
      }
    };
  }, [fetchThreadDetail]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-orange-200 rounded-full" />
            <div className="w-16 h-16 border-4 border-orange-500 rounded-full border-t-transparent animate-spin absolute top-0" />
          </div>
          <p className="mt-4 text-gray-600 font-medium">
            동화를 불러오는 중...
          </p>
          <p className="text-sm text-gray-500">잠시만 기다려주세요</p>
        </div>
      );
    }

    if (messages.length === 0) {
      return (
        <div className="text-center py-16">
          <div className="flex justify-center mb-6">
            <div className="relative w-24 h-24">
              <div className="absolute inset-0 bg-gray-100 rounded-full opacity-50 animate-pulse" />
              <div className="relative flex items-center justify-center w-full h-full bg-gray-50 rounded-full">
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
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            {errorMessage
              ? "동화 상세를 불러오지 못했어요"
              : "동화를 찾을 수 없어요"}
          </h2>
          <p className="text-gray-600 mb-6">
            {errorMessage ||
              "이 동화의 내용이 아직 생성되지 않았거나 문제가 발생했습니다."}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {errorMessage && (
              <button
                type="button"
                onClick={fetchThreadDetail}
                className="inline-flex items-center px-4 py-2 border border-orange-300 text-orange-700 rounded-lg hover:bg-orange-50 transition duration-200"
              >
                다시 시도
              </button>
            )}
            <Link
              href="/service"
              className="inline-flex items-center px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition duration-200"
            >
              <span>새 동화 만들기</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 ml-2"
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

    return (
      <div className="space-y-8">
        {imageUrl && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-green-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                동화 일러스트
              </h2>
            </div>
            <div className="p-4 sm:p-6">
              <div className="relative group">
                <Image
                  src={imageUrl}
                  alt="동화 일러스트"
                  className="w-full rounded-lg shadow-md transition-transform duration-300 group-hover:scale-[1.02]"
                  width={1024}
                  height={1024}
                  unoptimized
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-300 rounded-lg" />
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
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
                동화 내용
              </h2>

              {thread.able_english && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-600">언어:</span>
                  <div className="flex items-center gap-1">
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${!isShowEnglish ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-600"}`}
                    >
                      한국어
                    </span>
                    {isShowEnglish && (
                      <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">
                        + 영어
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 sm:p-6">
            <MessageDisplay
              messages={messages}
              isShowEnglish={isShowEnglish}
              useGoogleTTS={false}
              voice="female"
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className={`min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 transition-opacity duration-500 ${isPageLoaded ? "opacity-100" : "opacity-0"}`}
    >
      <div className="bg-white shadow-sm border-b border-orange-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={{
                  pathname: `/my-story`,
                }}
                className="group"
              >
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:border-orange-300 hover:bg-orange-50 transition-all duration-200">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 text-gray-600 group-hover:text-orange-600 transition-colors"
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
                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
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
                  <h1 className="text-lg sm:text-xl font-bold text-gray-800">
                    동화 이야기
                  </h1>
                  <p className="text-xs text-gray-500">
                    ID: {params?.thread_id}
                  </p>
                </div>
              </div>
            </div>

            {thread.able_english && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-200">
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
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isShowEnglish}
                      onChange={() => setIsShowEnglish(!isShowEnglish)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-blue-700">
                      영어 보기
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {detailDiagnostics?.degraded && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            동화 상세를 예비 경로로 불러왔어요
            {` (source=${detailDiagnostics.source}, reasons=${
              detailDiagnostics.reasons.length > 0
                ? detailDiagnostics.reasons.join(",")
                : "unknown"
            }).`}
            {" 일부 정보 반영이 지연될 수 있습니다."}
          </div>
        )}
        {errorMessage && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {renderContent()}
      </div>

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
