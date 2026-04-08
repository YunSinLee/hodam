"use client";

import { useCallback, useEffect, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import type { ThreadWithUser } from "@/app/types/openai";
import { formatTime } from "@/app/utils";
import { recoverSessionUserInfo } from "@/lib/auth/session-recovery";
import { buildSignInRedirectPath } from "@/lib/auth/sign-in-redirect";
import threadApi, { isThreadListUnavailable } from "@/lib/client/api/thread";
import { resolveThreadListErrorState } from "@/lib/ui/thread-list-error";
import useUserInfo from "@/services/hooks/use-user-info";

export default function MyStory() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);
  const [threads, setThreads] = useState<ThreadWithUser[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const { userInfo, setUserInfo } = useUserInfo();
  const router = useRouter();
  const [shouldRedirectToSignIn, setShouldRedirectToSignIn] =
    useState<boolean>(false);

  const loadingSkeletonKeys = [
    "skeleton-1",
    "skeleton-2",
    "skeleton-3",
    "skeleton-4",
    "skeleton-5",
    "skeleton-6",
  ];

  const fetchThreadsByUserId = useCallback(async () => {
    setIsLoading(true);
    setIsAuthReady(false);
    setErrorMessage(null);
    setWarningMessage(null);
    setShouldRedirectToSignIn(false);

    try {
      let activeUserId = userInfo.id;
      if (!activeUserId) {
        const recoveredUserInfo = await recoverSessionUserInfo();
        if (recoveredUserInfo?.id) {
          activeUserId = recoveredUserInfo.id;
          setUserInfo(recoveredUserInfo);
        }
      }

      setIsAuthReady(true);
      if (!activeUserId) {
        setThreads([]);
        setErrorMessage("로그인이 필요합니다. 다시 로그인해주세요.");
        setShouldRedirectToSignIn(true);
        return;
      }

      const { threads: nextThreads, diagnostics } =
        await threadApi.fetchThreadsByUserIdWithDiagnostics();
      setThreads(nextThreads);

      if (
        isThreadListUnavailable({
          threads: nextThreads,
          diagnostics,
        })
      ) {
        setWarningMessage(null);
        setErrorMessage(
          "동화 목록을 불러오는 중 일시적인 서버 문제가 발생했습니다. 잠시 후 다시 시도해주세요.",
        );
        return;
      }

      if (diagnostics.degraded) {
        const baseMessage =
          "동화 목록 조회가 지연되어 보조 경로로 처리되었습니다.";
        const reasonText = diagnostics.reasons.join(", ");
        const debugSuffix =
          process.env.NODE_ENV === "development"
            ? ` (source=${diagnostics.source}${
                reasonText ? `, reasons=${reasonText}` : ""
              })`
            : "";
        setWarningMessage(`${baseMessage}${debugSuffix}`);
      }
    } catch (error) {
      setIsAuthReady(true);
      setThreads([]);
      setWarningMessage(null);
      const errorState = resolveThreadListErrorState(error);
      setErrorMessage(errorState.message);
      setShouldRedirectToSignIn(errorState.shouldRedirectToSignIn);
    } finally {
      setIsLoading(false);
    }
  }, [setUserInfo, userInfo.id]);

  useEffect(() => {
    fetchThreadsByUserId();
  }, [fetchThreadsByUserId]);

  useEffect(() => {
    if (!shouldRedirectToSignIn) return undefined;

    const timer = setTimeout(() => {
      router.replace(buildSignInRedirectPath("/my-story"));
    }, 800);
    return () => clearTimeout(timer);
  }, [router, shouldRedirectToSignIn]);

  const renderContent = () => {
    if (isLoading || !isAuthReady) {
      return (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {loadingSkeletonKeys.map(key => (
            <div key={key} className="hodam-soft-card animate-pulse p-5">
              <div className="mb-4 h-4 w-3/4 rounded bg-[#f2dfc8]" />
              <div className="mb-3 h-3 w-1/2 rounded bg-[#f7ebdb]" />
              <div className="mb-2 h-3 w-full rounded bg-[#f8efdf]" />
              <div className="mt-6 flex justify-between">
                <div className="h-7 w-20 rounded-full bg-[#f7e6cf]" />
                <div className="h-7 w-24 rounded-full bg-[#f3dfc2]" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (threads.length === 0) {
      return (
        <section className="hodam-glass-card px-6 py-12 text-center sm:px-10">
          <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-[#fff3e4]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12 text-[#d88838]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.7}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
          </div>
          <h2 className="hodam-heading text-3xl text-[#2e3134]">
            아직 만든 동화가 없어요
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-[#5f6670] sm:text-base">
            첫 키워드만 입력하면 1분 안에 동화를 시작할 수 있습니다. 지금 바로
            새로운 이야기의 첫 장을 열어보세요.
          </p>
          <div className="mt-7">
            <Link href="/service" className="hodam-primary-button text-sm">
              새 동화 만들기
              <span aria-hidden>→</span>
            </Link>
          </div>
        </section>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {threads.map(thread => {
          const title =
            thread.keywords?.map(keyword => keyword.keyword).join(", ") ||
            "제목 없음";

          return (
            <Link
              key={thread.id}
              href={{
                pathname: `/my-story/${thread.id}`,
                query: {
                  ableEnglish: thread.able_english,
                },
              }}
              className="group"
            >
              <article className="hodam-soft-card relative h-full overflow-hidden p-5 transition duration-200 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(181,94,23,0.16)]">
                <div className="absolute right-0 top-0 h-28 w-28 rounded-bl-[30px] bg-gradient-to-br from-[#ffe8c8]/80 to-transparent" />

                <header className="relative z-10 mb-3 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#fff0dc] text-[#cf7b30]">
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
                        strokeWidth={1.9}
                        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-[#8b93a0]">
                      {formatTime(thread.created_at, "YYYY년 MM월 DD일")}
                    </p>
                    <p className="text-sm font-semibold text-[#364152]">
                      {thread.user?.display_name || "사용자"}
                    </p>
                  </div>
                </header>

                <h3 className="relative z-10 line-clamp-2 text-lg font-bold text-[#2d3138]">
                  {title}
                </h3>

                <footer className="relative z-10 mt-4 border-t border-[#f3e2cc] pt-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          thread.able_english
                            ? "bg-sky-100 text-sky-700"
                            : "bg-zinc-100 text-zinc-600"
                        }`}
                      >
                        {thread.able_english ? "영어 포함" : "한국어"}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          thread.has_image
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-zinc-100 text-zinc-600"
                        }`}
                      >
                        {thread.has_image ? "이미지 포함" : "텍스트 중심"}
                      </span>
                    </div>
                    <span className="rounded-full bg-[#fff2e1] px-2 py-1 text-xs font-bold text-[#b86b26] transition group-hover:bg-[#ffe5c1]">
                      열기
                    </span>
                  </div>
                </footer>
              </article>
            </Link>
          );
        })}
      </div>
    );
  };

  return (
    <div className="hodam-page-shell px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="hodam-glass-card p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#ad6220]">
            My Library
          </p>
          <h1 className="hodam-heading mt-2 text-3xl text-[#2e3134] sm:text-4xl">
            내 동화
          </h1>
          <p className="mt-2 text-sm text-[#5f6670] sm:text-base">
            내가 만든 동화를 다시 읽고, 이어서 선택지를 고르며 이야기를 확장할
            수 있어요.
          </p>
        </header>

        {errorMessage && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <p>{errorMessage}</p>
            {shouldRedirectToSignIn && (
              <button
                type="button"
                onClick={() =>
                  router.replace(buildSignInRedirectPath("/my-story"))
                }
                className="mt-2 rounded-full border border-red-300 bg-white px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-50"
              >
                다시 로그인
              </button>
            )}
          </div>
        )}

        {warningMessage && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {warningMessage}
          </div>
        )}

        {renderContent()}
      </div>
    </div>
  );
}
