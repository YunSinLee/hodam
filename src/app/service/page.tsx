"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import Image from "next/image";

import {
  ContinueStoryResponseSchema,
  StartStoryResponseSchema,
  StoryMessageSchema,
  StorySelectionSchema,
  TranslateStoryResponseSchema,
} from "@/app/api/v1/schemas";
import GuideForSign from "@/app/components/GuideForSign";
import KeywordInput from "@/app/components/KeywordInput";
import MessageDisplay from "@/app/components/MessageDisplay";
import SelectionDisplay from "@/app/components/SelectionDisplay";
import { ApiError, authorizedFetch } from "@/lib/client/api/http";
import userApi from "@/lib/client/api/user";
import useBead from "@/services/hooks/use-bead";
import useUserInfo from "@/services/hooks/use-user-info";

import type { z } from "zod";

type StoryMessage = z.infer<typeof StoryMessageSchema>;
type StorySelection = z.infer<typeof StorySelectionSchema>;
type StartStoryResponse = z.infer<typeof StartStoryResponseSchema>;
type ContinueStoryResponse = z.infer<typeof ContinueStoryResponseSchema>;
type TranslateStoryResponse = z.infer<typeof TranslateStoryResponseSchema>;

interface PageFeedback {
  type: "error" | "success";
  message: string;
}

function applyErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return "로그인이 필요합니다.";
    if (error.status === 402) return "곶감이 부족합니다.";
    if (error.status === 429)
      return "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.";
    return error.message;
  }

  if (error instanceof Error) return error.message;
  return "요청 처리 중 오류가 발생했습니다.";
}

export default function Hodam() {
  const [threadId, setThreadId] = useState<number | null>(null);
  const [keywords, setKeywords] = useState<string>("");
  const [messages, setMessages] = useState<StoryMessage[]>([]);
  const [notice, setNotice] = useState<string>("");
  const [selections, setSelections] = useState<StorySelection[]>([]);
  const [isImageLoading, setIsImageLoading] = useState<boolean>(false);
  const [isStoryLoading, setIsStoryLoading] = useState<boolean>(false);
  const [images, setImages] = useState<string[]>([]);
  const [isEnglishIncluded, setIsEnglishIncluded] = useState<boolean>(false);
  const [isShowEnglish, setIsShowEnglish] = useState<boolean>(false);
  const [isImageIncluded, setIsImageIncluded] = useState<boolean>(false);
  const [isStarted, setIsStarted] = useState<boolean>(false);
  const [pageFeedback, setPageFeedback] = useState<PageFeedback | null>(null);

  const [translationInProgress, setTranslationInProgress] =
    useState<boolean>(false);

  const [selectedChoice, setSelectedChoice] = useState<string>("");
  const [isSelectionLoading, setIsSelectionLoading] = useState<boolean>(false);

  const { userInfo, setUserInfo, hasHydrated } = useUserInfo();
  const { bead, setBead } = useBead();

  const neededBeadCount = useMemo(() => {
    let count = 1;
    if (isEnglishIncluded) count += 1;
    if (isImageIncluded) count += 1;
    return count;
  }, [isEnglishIncluded, isImageIncluded]);

  const keywordPresets = useMemo(
    () => [
      {
        label: "달빛 숲 모험",
        value: "용감한 토끼, 달빛 숲, 보물지도",
      },
      {
        label: "바다마을 인어",
        value: "민지, 바다마을, 인어 친구",
      },
      {
        label: "우주 고양이",
        value: "우주비행사 고양이, 화성, 별사탕",
      },
    ],
    [],
  );

  const stageContainerRef = useRef<HTMLDivElement | null>(null);

  const currentStage = useMemo(() => {
    if (!isStarted) return 0;
    if (isSelectionLoading && isStoryLoading) return 3;
    if (isStoryLoading || isImageLoading) return 2;
    if (translationInProgress) return 3;
    if (selections.length > 0) return 3;
    if (messages.length > 0) return 4;
    return 1;
  }, [
    isImageLoading,
    isSelectionLoading,
    isStarted,
    isStoryLoading,
    messages.length,
    selections.length,
    translationInProgress,
  ]);

  const stageItems = useMemo(
    () => ["키워드 입력", "옵션 선택", "스토리 생성", "분기 진행", "완료"],
    [],
  );

  const getStageClassName = useCallback(
    (index: number) => {
      if (index < currentStage) {
        return "border-[#ef8d3d]/30 bg-[#fff0de] text-[#9f5b20]";
      }

      if (index === currentStage) {
        return "border-[#ef8d3d]/45 bg-[#ef8d3d] text-white shadow-[0_8px_20px_rgba(215,120,37,0.3)]";
      }

      return "border-[#ef8d3d]/15 bg-white/75 text-[#7a828e]";
    },
    [currentStage],
  );

  const applyBeadCount = useCallback(
    (nextCount: number) => {
      setBead({
        ...bead,
        count: nextCount,
        user_id: userInfo.id,
      });
    },
    [bead, setBead, userInfo.id],
  );

  const getSession = useCallback(async () => {
    const userData = await userApi.getSession();
    if (userData) {
      setUserInfo(userData);
    }
  }, [setUserInfo]);

  const handleEnglishIncludedChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setIsEnglishIncluded(event.target.checked);
    },
    [],
  );

  const handleImageIncludedChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setIsImageIncluded(event.target.checked);
    },
    [],
  );

  const handleSelectionClear = useCallback(() => {
    setSelectedChoice("");
  }, []);

  useEffect(() => {
    getSession();
  }, [getSession]);

  useEffect(() => {
    if (!isStarted || !stageContainerRef.current) {
      return () => undefined;
    }

    const timer = setTimeout(() => {
      stageContainerRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 120);

    return () => clearTimeout(timer);
  }, [isStarted, isStoryLoading, isSelectionLoading, messages.length]);

  const inputKeywords = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setKeywords(event.target.value);
    },
    [],
  );

  const searchKeywords = useCallback(async () => {
    setPageFeedback(null);

    if (!userInfo.id) {
      setPageFeedback({ type: "error", message: "로그인이 필요합니다." });
      return;
    }

    const normalizedKeywords = keywords
      .split(",")
      .map(item => item.trim())
      .filter(Boolean);

    if (normalizedKeywords.length === 0) {
      setPageFeedback({
        type: "error",
        message: "키워드를 1개 이상 입력해주세요.",
      });
      return;
    }

    setIsStarted(true);
    setIsStoryLoading(true);
    setIsImageLoading(Boolean(isImageIncluded));

    try {
      const response = await authorizedFetch<StartStoryResponse>(
        "/api/v1/story/start",
        {
          method: "POST",
          body: JSON.stringify({
            keywords: normalizedKeywords.join(", "),
            includeEnglish: isEnglishIncluded,
            includeImage: isImageIncluded,
          }),
        },
        StartStoryResponseSchema,
      );

      setThreadId(response.threadId);
      setMessages(response.messages || []);
      setSelections(response.selections || []);
      setNotice(response.notice || "");
      setImages(response.imageUrl ? [response.imageUrl] : []);
      applyBeadCount(response.beadCount);

      if (response.includeEnglish) {
        setIsShowEnglish(true);
      }
    } catch (error) {
      const message = applyErrorMessage(error);
      setPageFeedback({ type: "error", message });
      setIsStarted(false);
    } finally {
      setIsStoryLoading(false);
      setIsImageLoading(false);
    }
  }, [
    applyBeadCount,
    isEnglishIncluded,
    isImageIncluded,
    keywords,
    userInfo.id,
  ]);

  const clickSelection = useCallback(
    async (selection: string) => {
      setPageFeedback(null);

      if (!threadId) {
        setPageFeedback({
          type: "error",
          message: "동화를 먼저 시작해주세요.",
        });
        return;
      }

      if (!selection || !selection.trim()) {
        setPageFeedback({
          type: "error",
          message: "선택지가 올바르지 않습니다.",
        });
        return;
      }

      if (isStoryLoading || isSelectionLoading) {
        return;
      }

      setIsSelectionLoading(true);
      setSelectedChoice(selection);
      setIsStoryLoading(true);
      setSelections([]);

      try {
        const response = await authorizedFetch<ContinueStoryResponse>(
          "/api/v1/story/continue",
          {
            method: "POST",
            body: JSON.stringify({
              threadId,
              selection,
            }),
          },
          ContinueStoryResponseSchema,
        );

        setMessages(prev => [...prev, ...(response.messages || [])]);
        setSelections(response.selections || []);
        setNotice(response.notice || "");
        applyBeadCount(response.beadCount);
      } catch (error) {
        setPageFeedback({
          type: "error",
          message: applyErrorMessage(error),
        });
      } finally {
        setIsStoryLoading(false);
        setIsSelectionLoading(false);
        setSelectedChoice("");
      }
    },
    [applyBeadCount, isSelectionLoading, isStoryLoading, threadId],
  );

  async function translateStory() {
    if (!isStarted || messages.length === 0 || !threadId) return;

    setPageFeedback(null);
    setTranslationInProgress(true);
    try {
      const response = await authorizedFetch<TranslateStoryResponse>(
        "/api/v1/story/translate",
        {
          method: "POST",
          body: JSON.stringify({ threadId }),
        },
        TranslateStoryResponseSchema,
      );

      setMessages(prev =>
        prev.map((message, index) => ({
          ...message,
          text_en: response.messages[index]?.text_en || message.text_en,
        })),
      );

      setIsShowEnglish(true);
      setIsEnglishIncluded(true);
      applyBeadCount(response.beadCount);
    } catch (error) {
      setPageFeedback({
        type: "error",
        message: applyErrorMessage(error),
      });
    } finally {
      setTranslationInProgress(false);
    }
  }

  return (
    <div className="hodam-page-shell px-4 pb-12 pt-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div
          ref={stageContainerRef}
          className="mb-4 rounded-2xl border border-[#ef8d3d]/20 bg-white/85 px-4 py-3 text-sm text-[#5f6670] shadow-[0_10px_24px_rgba(181,94,23,0.09)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-[#9b5518]">서비스 이용 흐름</p>
            <span className="rounded-full border border-[#ef8d3d]/20 bg-[#fff8ef] px-2.5 py-1 text-xs font-semibold text-[#a25a1d]">
              현재 단계: {stageItems[currentStage]}
            </span>
          </div>
          <p className="mt-1">
            키워드 입력 → 옵션 선택 → 스토리 생성 → 분기 진행 → 완료
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {stageItems.map((item, index) => (
              <div
                key={item}
                className={`rounded-xl border px-2 py-2 text-center text-xs font-semibold transition ${getStageClassName(
                  index,
                )}`}
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        {pageFeedback && (
          <div
            className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${
              pageFeedback.type === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-green-200 bg-green-50 text-green-700"
            }`}
          >
            {pageFeedback.message}
          </div>
        )}

        {!hasHydrated && (
          <div className="rounded-2xl border border-[#ef8d3d]/20 bg-white/90 px-4 py-8 text-center shadow-[0_14px_30px_rgba(181,94,23,0.08)]">
            <div className="mx-auto mb-3 h-9 w-9 animate-spin rounded-full border-2 border-[#f1c79f] border-t-[#ef8d3d]" />
            <p className="text-sm font-semibold text-[#9b5518]">
              로그인 상태를 확인하는 중입니다...
            </p>
          </div>
        )}

        {hasHydrated && userInfo.id && (
          <div className="space-y-5">
            <div className="grid gap-4 rounded-2xl border border-[#ef8d3d]/20 bg-white/85 p-4 shadow-[0_14px_30px_rgba(181,94,23,0.08)] sm:grid-cols-[1.2fr_0.8fr]">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#a05a1a]">
                  빠른 시작 키워드
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {keywordPresets.map(preset => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setKeywords(preset.value)}
                      className="rounded-full border border-[#ef8d3d]/25 bg-[#fff8ef] px-3 py-1 text-xs font-semibold text-[#9b5518] transition hover:border-[#ef8d3d]/45"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-[#ef8d3d]/18 bg-[#fff9f1] px-4 py-3 text-xs text-[#6b7280]">
                <p className="font-semibold text-[#9b5518]">Tip</p>
                <p className="mt-1">
                  키워드는 3~4개가 가장 자연스럽습니다. 인물, 장소, 사건 요소를
                  함께 넣어주세요.
                </p>
              </div>
            </div>

            <KeywordInput
              neededBeadCount={neededBeadCount}
              keywords={keywords}
              isEnglishIncluded={isEnglishIncluded}
              isImageIncluded={isImageIncluded}
              onKeywordsChange={inputKeywords}
              onButtonClicked={searchKeywords}
              onEnglishIncludedChange={handleEnglishIncludedChange}
              onImageIncludedChange={handleImageIncludedChange}
            />

            {isImageIncluded && isStoryLoading && !isStarted && (
              <div className="rounded-2xl border border-[#6ba7ed]/25 bg-[#eef6ff] p-4 text-center">
                <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-2 border-[#93c3f6] border-t-[#3c8be6]" />
                <p className="text-sm font-semibold text-[#2f6fc0]">
                  이미지 생성 중...
                </p>
              </div>
            )}

            {isStarted && (
              <div className="space-y-4">
                {isImageIncluded && (
                  <section className="animate-[fadeInUp_0.35s_ease-out] rounded-2xl border border-[#ef8d3d]/18 bg-white/88 p-4 shadow-[0_14px_30px_rgba(181,94,23,0.07)]">
                    <h2 className="hodam-heading mb-3 text-2xl text-[#2f3033]">
                      동화 이미지
                    </h2>
                    <div className="grid grid-cols-1 gap-3">
                      {images.map((src, index) => (
                        <Image
                          key={src}
                          src={src}
                          className="w-full rounded-xl border border-[#ef8d3d]/20"
                          alt={`동화 이미지 ${index + 1}`}
                          width={1024}
                          height={1024}
                          unoptimized
                        />
                      ))}
                      {isImageLoading && !isSelectionLoading && (
                        <div className="relative w-full rounded-xl border border-[#d7e8fb] bg-[#eff6ff] pb-[100%]">
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <div className="h-9 w-9 animate-spin rounded-full border-2 border-[#8db8f2] border-t-[#3a83dc]" />
                            <p className="mt-2 text-sm font-semibold text-[#2e67a9]">
                              이미지 생성 중...
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {isStoryLoading && !isSelectionLoading && (
                  <div className="rounded-2xl border border-[#ef8d3d]/20 bg-[#fff7ee] p-4 text-center">
                    <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-2 border-[#f2be8f] border-t-[#ef8d3d]" />
                    <p className="text-sm font-semibold text-[#a25a1d]">
                      첫 번째 동화를 생성하고 있습니다...
                    </p>
                  </div>
                )}

                {messages.length > 0 && (
                  <section className="animate-[fadeInUp_0.35s_ease-out] rounded-2xl border border-[#ef8d3d]/18 bg-white/88 p-4 shadow-[0_14px_30px_rgba(181,94,23,0.07)]">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h2 className="hodam-heading text-2xl text-[#2f3033]">
                        동화 내용
                      </h2>
                      {isEnglishIncluded && (
                        <button
                          type="button"
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            isShowEnglish
                              ? "bg-[#ef8d3d] text-white"
                              : "bg-[#f3f4f6] text-[#4b5563]"
                          }`}
                          onClick={() => setIsShowEnglish(!isShowEnglish)}
                        >
                          {isShowEnglish ? "한국어만 보기" : "영어 함께 보기"}
                        </button>
                      )}
                      {!isEnglishIncluded && messages.length > 0 && (
                        <button
                          type="button"
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            translationInProgress
                              ? "cursor-not-allowed bg-gray-400 text-white"
                              : "bg-[#ef8d3d] text-white"
                          }`}
                          onClick={translateStory}
                          disabled={translationInProgress}
                        >
                          {translationInProgress
                            ? "번역 중..."
                            : "영어로 번역하기"}
                        </button>
                      )}
                    </div>
                    <MessageDisplay
                      messages={messages}
                      isShowEnglish={isShowEnglish}
                      useGoogleTTS
                    />
                  </section>
                )}

                {isSelectionLoading && isStoryLoading && (
                  <div className="rounded-2xl border border-[#ef8d3d]/20 bg-[#fff7ee] p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#ef8d3d] border-t-transparent" />
                      <div>
                        <p className="text-sm font-semibold text-[#a25a1d]">
                          새로운 이야기를 생성하고 있습니다...
                        </p>
                        <p className="mt-1 text-xs text-[#bc7331]">
                          선택하신 내용을 바탕으로 동화를 이어가고 있어요.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {notice && (
                  <p className="rounded-xl border border-[#ef8d3d]/18 bg-[#fff8ef] px-3 py-2 text-sm text-[#a05a1a]">
                    {notice}
                  </p>
                )}

                {selections.length > 0 && (
                  <section className="animate-[fadeInUp_0.35s_ease-out] rounded-2xl border border-[#ef8d3d]/18 bg-white/88 p-4 shadow-[0_14px_30px_rgba(181,94,23,0.07)]">
                    <h2 className="hodam-heading mb-2 text-2xl text-[#2f3033]">
                      다음 전개를 선택하세요
                    </h2>
                    <SelectionDisplay
                      selections={selections}
                      isShowEnglish={isShowEnglish}
                      onSelectionClick={clickSelection}
                      notice={notice}
                      onClear={handleSelectionClear}
                      selectedChoice={selectedChoice}
                      isSelectionLoading={isSelectionLoading}
                    />
                  </section>
                )}
              </div>
            )}
          </div>
        )}

        {hasHydrated && !userInfo.id && <GuideForSign />}
      </div>
    </div>
  );
}
