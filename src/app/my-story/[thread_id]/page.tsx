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
  const [shouldRedirectToSignIn, setShouldRedirectToSignIn] =
    useState<boolean>(false);

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
      setShouldRedirectToSignIn(false);
      setErrorMessage("잘못된 동화 ID입니다.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setShouldRedirectToSignIn(false);

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
      setShouldRedirectToSignIn(errorState.shouldRedirectToSignIn);

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

    return () => {
      if (signInRedirectTimerRef.current) {
        clearTimeout(signInRedirectTimerRef.current);
        signInRedirectTimerRef.current = null;
      }
    };
  }, [fetchThreadDetail]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="rounded-3xl border border-[#ef8d3d]/20 bg-white/90 px-6 py-14 text-center shadow-[0_16px_36px_rgba(181,94,23,0.1)]">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-[#f1cdab] border-t-[#ef8d3d]" />
          <p className="text-base font-semibold text-[#374151]">
            동화를 불러오는 중...
          </p>
          <p className="mt-1 text-sm text-[#6b7280]">잠시만 기다려주세요.</p>
        </div>
      );
    }

    if (messages.length === 0) {
      return (
        <div className="hodam-glass-card px-6 py-14 text-center sm:px-10">
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
                d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.29-1.009-5.824-2.562M15 6.306a7.962 7.962 0 00-6 0m6 0V5a2 2 0 00-2-2H9a2 2 0 00-2 2v1.306m8 0V7a2 2 0 012 2v10a2 2 0 01-2 2H7a2 2 0 01-2-2V9a2 2 0 012-2h8a2 2 0 012 2v1.306z"
              />
            </svg>
          </div>
          <h2 className="hodam-heading text-3xl text-[#2f3338]">
            {errorMessage
              ? "동화 상세를 불러오지 못했어요"
              : "동화를 찾을 수 없어요"}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-[#5f6670] sm:text-base">
            {errorMessage ||
              "이 동화의 내용이 아직 생성되지 않았거나 문제가 발생했습니다."}
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            {errorMessage && (
              <button
                type="button"
                onClick={fetchThreadDetail}
                className="hodam-outline-button text-sm"
              >
                다시 시도
              </button>
            )}
            {shouldRedirectToSignIn && (
              <button
                type="button"
                onClick={() =>
                  router.replace(
                    buildSignInRedirectPath(`/my-story/${threadId}`),
                  )
                }
                className="hodam-outline-button text-sm"
              >
                로그인하기
              </button>
            )}
            <Link href="/service" className="hodam-primary-button text-sm">
              새 동화 만들기
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        {imageUrl && (
          <section className="hodam-soft-card overflow-hidden p-0">
            <div className="border-b border-[#f3e2cc] px-5 py-4 sm:px-6">
              <h2 className="text-lg font-bold text-[#2f3338]">
                동화 일러스트
              </h2>
            </div>
            <div className="p-4 sm:p-6">
              <div className="relative overflow-hidden rounded-2xl border border-[#f0deca] bg-[#fffaf3]">
                <Image
                  src={imageUrl}
                  alt="동화 일러스트"
                  className="h-auto w-full"
                  width={1024}
                  height={1024}
                  unoptimized
                />
              </div>
            </div>
          </section>
        )}

        <section className="hodam-soft-card overflow-hidden p-0">
          <div className="border-b border-[#f3e2cc] px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-bold text-[#2f3338]">동화 내용</h2>

              {thread.able_english && (
                <label className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm font-semibold text-sky-700">
                  <input
                    type="checkbox"
                    checked={isShowEnglish}
                    onChange={() => setIsShowEnglish(prev => !prev)}
                    className="h-4 w-4 rounded text-sky-600 focus:ring-sky-500"
                  />
                  영어 보기
                </label>
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
        </section>
      </div>
    );
  };

  return (
    <div className="hodam-page-shell min-h-screen px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="hodam-glass-card p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Link href="/my-story" className="hodam-outline-button text-sm">
                목록으로
              </Link>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#ad6220]">
                  Story Detail
                </p>
                <h1 className="hodam-heading mt-1 text-2xl text-[#2f3338] sm:text-3xl">
                  동화 이야기
                </h1>
                <p className="mt-1 text-xs text-[#6b7280] sm:text-sm">
                  ID: {params?.thread_id}
                </p>
              </div>
            </div>

            {thread.able_english && (
              <span className="inline-flex items-center rounded-full bg-[#eaf4ff] px-3 py-1 text-xs font-semibold text-[#2f6db4]">
                한국어 + 영어 동화
              </span>
            )}
          </div>
        </header>

        {detailDiagnostics?.degraded && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            동화 상세를 예비 경로로 불러왔습니다.
            {` (source=${detailDiagnostics.source}, reasons=${
              detailDiagnostics.reasons.length > 0
                ? detailDiagnostics.reasons.join(",")
                : "unknown"
            })`}
          </div>
        )}

        {errorMessage && messages.length > 0 && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {renderContent()}
      </div>
    </div>
  );
}
