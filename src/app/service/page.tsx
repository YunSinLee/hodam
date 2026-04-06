"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

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
    <div className="flex flex-col items-center gap-4 p-4">
      <div className="w-full max-w-2xl">
        <div className="flex flex-col gap-4">
          {pageFeedback && (
            <div
              className={`rounded-lg border px-4 py-3 text-sm ${
                pageFeedback.type === "error"
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-green-200 bg-green-50 text-green-700"
              }`}
            >
              {pageFeedback.message}
            </div>
          )}
          {!hasHydrated && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-6 text-center">
              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-orange-200 border-t-orange-500" />
              <p className="text-sm text-orange-700">
                로그인 상태를 확인하는 중입니다...
              </p>
            </div>
          )}
          {hasHydrated && userInfo.id && (
            <div className="flex flex-col gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className={`w-5 h-5 rounded-full ${
                      isEnglishIncluded ? "bg-orange-500" : "bg-gray-300"
                    }`}
                    onClick={() => setIsEnglishIncluded(!isEnglishIncluded)}
                  />
                  <span>영어 번역 포함</span>
                  <div
                    className={`w-5 h-5 rounded-full ${
                      isImageIncluded ? "bg-orange-500" : "bg-gray-300"
                    }`}
                    onClick={() => setIsImageIncluded(!isImageIncluded)}
                  />
                  <span>그림 생성 포함</span>
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
              </div>
              {isImageIncluded && isStoryLoading && !isStarted && (
                <div className="flex justify-center mb-4">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 border-4 border-blue-500 rounded-full border-t-transparent animate-spin" />
                    <p className="mt-2 text-blue-500">이미지 생성 중...</p>
                  </div>
                </div>
              )}
              {isStarted && (
                <div>
                  {isImageIncluded && (
                    <div className="mb-4">
                      <h2 className="mb-2 text-xl">동화 이미지</h2>
                      <div className="grid grid-cols-1 gap-2">
                        {images.map((src, index) => (
                          <Image
                            key={src}
                            src={src}
                            className="w-full rounded-md"
                            alt={`동화 이미지 ${index + 1}`}
                            width={1024}
                            height={1024}
                            unoptimized
                          />
                        ))}
                        {isImageLoading && !isSelectionLoading && (
                          <div className="relative w-full pb-[100%] bg-gray-100 rounded-md">
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <div className="w-10 h-10 border-4 border-blue-500 rounded-full border-t-transparent animate-spin" />
                              <p className="mt-2 text-blue-500">
                                이미지 생성 중...
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {isStoryLoading && !isSelectionLoading && (
                    <div className="flex justify-center mb-4">
                      <div className="flex flex-col items-center">
                        <div className="w-10 h-10 border-4 border-orange-500 rounded-full border-t-transparent animate-spin" />
                        <p className="mt-2 text-orange-500">
                          첫 번째 동화를 생성하고 있습니다...
                        </p>
                      </div>
                    </div>
                  )}

                  {messages.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <h2 className="text-xl">동화 내용</h2>
                        {isEnglishIncluded && (
                          <button
                            type="button"
                            className={`px-3 py-1 text-sm rounded-md ${
                              isShowEnglish
                                ? "bg-orange-500 text-white"
                                : "bg-gray-200"
                            }`}
                            onClick={() => setIsShowEnglish(!isShowEnglish)}
                          >
                            {isShowEnglish ? "한국어만 보기" : "영어 함께 보기"}
                          </button>
                        )}
                        {!isEnglishIncluded && messages.length > 0 && (
                          <button
                            type="button"
                            className={`px-3 py-1 text-sm rounded-md ${
                              translationInProgress
                                ? "bg-gray-400 cursor-not-allowed"
                                : "bg-orange-500 text-white"
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
                    </div>
                  )}

                  {isSelectionLoading && isStoryLoading && (
                    <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 border-2 border-orange-500 rounded-full border-t-transparent animate-spin" />
                        <div>
                          <p className="text-orange-700 font-medium">
                            새로운 이야기를 생성하고 있습니다...
                          </p>
                          <p className="text-orange-600 text-sm mt-1">
                            선택하신 내용을 바탕으로 동화를 이어가고 있어요.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {notice && <p className="mb-4 text-orange-500">{notice}</p>}

                  {selections.length > 0 && (
                    <div className="mb-4">
                      <h2 className="mb-2 text-xl">다음 전개를 선택하세요</h2>
                      <SelectionDisplay
                        selections={selections}
                        isShowEnglish={isShowEnglish}
                        onSelectionClick={clickSelection}
                        notice={notice}
                        onClear={handleSelectionClear}
                        selectedChoice={selectedChoice}
                        isSelectionLoading={isSelectionLoading}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {hasHydrated && !userInfo.id && <GuideForSign />}
        </div>
      </div>
    </div>
  );
}
