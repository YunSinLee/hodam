"use client";

import React, { useEffect, useMemo, useState } from "react";

// LangChain 함수 import
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";

import imageApi from "@/app/api/image";
import keywordsApi from "@/app/api/keywords";
import messagesApi from "@/app/api/messages";
import threadApi from "@/app/api/thread";
import userApi from "@/app/api/user";
import GuideForSign from "@/app/components/GuideForSign";
import KeywordInput from "@/app/components/KeywordInput";
import MessageDisplay from "@/app/components/MessageDisplay";
import SelectionDisplay from "@/app/components/SelectionDisplay";
import useBead from "@/services/hooks/use-bead";
import useUserInfo from "@/services/hooks/use-user-info";

import beadApi from "../api/bead";
import {
  generateFairyTale,
  generateImage,
  generateNextPart,
  integrateEnglishTranslation,
  translateToEnglish,
} from "../api/langchain";
import { Message, Thread } from "../types/openai";

export default function Hodam() {
  const [thread, setThread] = useState<Thread | null>(null);
  const [keywords, setKeywords] = useState<string>("");
  const [rawText, setRawText] = useState<string>("");
  const [messages, setMessages] = useState<{ text: string; text_en: string }[]>(
    [],
  );
  const [notice, setNotice] = useState<string>("");
  const [selections, setSelections] = useState<
    { text: string; text_en: string }[]
  >([]);
  const [isImageLoading, setIsImageLoading] = useState<boolean>(false);
  const [isStoryLoading, setIsStoryLoading] = useState<boolean>(false);
  const [images, setImages] = useState<string[]>([]);
  const [turn, setTurn] = useState<number>(0);
  const [isEnglishIncluded, setIsEnglishIncluded] = useState<boolean>(false);
  const [isShowEnglish, setIsShowEnglish] = useState<boolean>(false);
  const [isImageIncluded, setIsImageIncluded] = useState<boolean>(false);
  const [isStarted, setIsStarted] = useState<boolean>(false);

  // 번역 상태
  const [translationInProgress, setTranslationInProgress] =
    useState<boolean>(false);

  // 선택지 클릭 로딩 상태 추가
  const [selectedChoice, setSelectedChoice] = useState<string>("");
  const [isSelectionLoading, setIsSelectionLoading] = useState<boolean>(false);

  // 대화 기록 유지를 위한 상태 (직렬화 가능한 형태로 변경)
  const [langchainMessages, setLangchainMessages] = useState<
    {
      type: string;
      content: string;
    }[]
  >([]);

  const { userInfo, setUserInfo } = useUserInfo();
  const { bead, setBead } = useBead();

  const neededBeadCount = useMemo(() => {
    let count = 1;
    if (isEnglishIncluded) count++;
    if (isImageIncluded) count++;
    return count;
  }, [isEnglishIncluded, isImageIncluded]);

  useEffect(() => {
    getSession();
  }, []);

  // 이미지 생성은 이제 각 함수 내에서 비동기적으로 처리

  async function getSession() {
    const userData = await userApi.getSession();
    if (userData) {
      setUserInfo(userData);
    }
  }

  function inputKeywords(e: React.ChangeEvent<HTMLInputElement>) {
    const { value } = e.target;
    setKeywords(value);
  }

  async function startThread() {
    // 이 함수는 이제 searchKeywords에서만 호출됨
    const thread = await threadApi.createThread({
      thread_id: `langchain_${Date.now()}`,
      user_id: userInfo.id,
      able_english: isEnglishIncluded,
      has_image: isImageIncluded,
    });
    setThread(thread);
    return thread;
  }

  async function consumeBeads() {
    if (!userInfo.id || bead.count === undefined) return;

    if (bead.count < neededBeadCount) {
      alert("곶감이 부족합니다.");
      throw new Error("Not enough beads");
    }

    const beadInfo = await beadApi.updateBeadCount(
      userInfo.id,
      bead.count - neededBeadCount,
    );
    setBead(beadInfo);
  }

  // 메시지 직렬화 및 역직렬화 유틸리티 함수
  const serializeMessages = (
    messages: (HumanMessage | AIMessage | SystemMessage)[],
  ) => {
    try {
      // 입력 검증
      if (!Array.isArray(messages)) {
        console.error("Invalid messages array:", messages);
        return [];
      }

      return messages
        .filter(msg => {
          // 유효한 메시지인지 확인
          if (!msg || typeof msg !== "object") {
            console.warn("Invalid message object:", msg);
            return false;
          }
          if (!msg.content || typeof msg.content !== "string") {
            console.warn("Invalid message content:", msg);
            return false;
          }
          return true;
        })
        .map(msg => {
          try {
            let type = "ai"; // 기본값

            if (msg instanceof SystemMessage) {
              type = "system";
            } else if (msg instanceof HumanMessage) {
              type = "human";
            } else if (msg instanceof AIMessage) {
              type = "ai";
            }

            return {
              type,
              content: String(msg.content), // 문자열로 확실히 변환
            };
          } catch (serializeError) {
            console.error("Error serializing message:", serializeError);
            // 에러 발생 시 기본 구조 반환
            return {
              type: "ai",
              content: String(msg.content || ""),
            };
          }
        })
        .filter(serialized => serialized !== null); // null 값 제거
    } catch (error) {
      console.error("Error in serializeMessages:", error);
      return [];
    }
  };

  const deserializeMessages = (
    serialized: { type: string; content: string }[],
  ) => {
    try {
      // 입력 검증
      if (!Array.isArray(serialized)) {
        console.error("Invalid serialized messages array:", serialized);
        return [];
      }

      return serialized
        .filter(msg => {
          // 유효한 메시지인지 확인
          if (!msg || typeof msg !== "object") {
            console.warn("Invalid message object:", msg);
            return false;
          }
          if (!msg.type || typeof msg.type !== "string") {
            console.warn("Invalid message type:", msg);
            return false;
          }
          if (!msg.content || typeof msg.content !== "string") {
            console.warn("Invalid message content:", msg);
            return false;
          }
          return true;
        })
        .map(msg => {
          try {
            if (msg.type === "system") {
              return new SystemMessage(msg.content);
            }
            if (msg.type === "human") {
              return new HumanMessage(msg.content);
            }
            if (msg.type === "ai") {
              return new AIMessage(msg.content);
            }
            // 기본값으로 AI 메시지 반환
            console.warn("Unknown message type, defaulting to AI:", msg.type);
            return new AIMessage(msg.content || "");
          } catch (messageError) {
            console.error("Error creating message object:", messageError);
            // 에러 발생 시 기본 AI 메시지 반환
            return new AIMessage(msg.content || "");
          }
        })
        .filter(msg => msg !== null); // null 값 제거
    } catch (error) {
      console.error("Error in deserializeMessages:", error);
      return [];
    }
  };

  async function searchKeywords() {
    await consumeBeads();
    setIsStarted(true);
    setIsStoryLoading(true);

    // 시작부터 이미지 생성이 포함되어 있음을 표시
    if (isImageIncluded) {
      setIsImageLoading(false);
    }

    try {
      // 항상 새로운 thread 생성 (동화 생성 시작 시점)
      const currentThread = await startThread();

      // 키워드 저장
      const keywordArray = keywords.split(",").map(k => k.trim());
      await keywordsApi.saveKeywords({
        keywords: keywordArray,
        thread_id: currentThread.id,
      });

      // LangChain으로 동화 생성
      const { storyHtml, messages: updatedMessages } =
        await generateFairyTale(keywords);

      if (updatedMessages) {
        // 직렬화 가능한 형태로 메시지 저장
        setLangchainMessages(serializeMessages(updatedMessages));
      }

      await threadApi.updateThread({
        thread_id: currentThread.id,
        user_id: userInfo.id,
        raw_text: storyHtml,
      });

      setRawText(storyHtml);

      // HTML에서 정보 추출
      const {
        messages: newMessages,
        selections: newSelections,
        notice: newNotice,
      } = extractInfoFromHTML(storyHtml);

      // 영어 번역 처리
      let finalMessages = newMessages;
      if (isEnglishIncluded) {
        // 모든 한국어 메시지 추출
        const koreanTexts = newMessages.map(msg => msg.korean).join("\n\n");
        // 영어로 번역
        const englishTranslation = await translateToEnglish(koreanTexts);
        // 영어 번역 통합
        const combinedHtml = await integrateEnglishTranslation(
          storyHtml,
          englishTranslation,
        );

        // 통합된 HTML에서 정보 재추출
        const extractedInfo = extractInfoFromHTML(combinedHtml);
        finalMessages = extractedInfo.messages;

        // 선택지도 업데이트
        newSelections.forEach((selection, index) => {
          if (index < extractedInfo.selections.length) {
            selection.english = extractedInfo.selections[index].english;
          }
        });
      }

      // 메시지 저장
      const messageObjects = finalMessages.map(msg => ({
        korean: msg.korean,
        english: msg.english || "",
      }));

      const savedMessages = await messagesApi.saveMessages({
        messages: messageObjects,
        thread_id: currentThread.id,
        turn,
      });

      const messageMaps = savedMessages.map((item: Message) => ({
        text: item.message,
        text_en: item.message_en,
      }));

      setMessages(messageMaps);
      setSelections(
        newSelections.map(s => ({
          text: s.korean,
          text_en: s.english || "",
        })),
      );
      setNotice(newNotice);
      setTurn(turn + 1);

      // 번역이 이미 포함되어 있다면 영어 표시 활성화
      if (isEnglishIncluded) {
        setIsShowEnglish(true);
      }

      // 이야기 로딩 완료 표시
      setIsStoryLoading(false);

      // 이미지 생성은 이야기 로딩 완료 후 비동기적으로 처리
      if (isImageIncluded) {
        setIsImageLoading(true);
        // 실제 동화 내용을 이미지 생성에 사용
        const storyText = finalMessages.map(msg => msg.korean).join("\n\n");
        getImage(storyText, currentThread.id).finally(() => {
          setIsImageLoading(false);
        });
      }
    } catch (error) {
      console.error("Error generating story:", error);
      alert("동화 생성 중 오류가 발생했습니다. 다시 시도해주세요.");
      setIsStoryLoading(false);
    }
  }

  async function clickSelection(selection: string) {
    try {
      // 입력 검증
      if (
        !selection ||
        typeof selection !== "string" ||
        selection.trim().length === 0
      ) {
        console.error("Invalid selection:", selection);
        alert("선택지가 올바르지 않습니다.");
        return;
      }

      // thread가 없으면 선택지를 클릭할 수 없음
      if (!thread?.id) {
        alert("동화를 먼저 시작해주세요.");
        return;
      }

      // userInfo 검증
      if (!userInfo?.id) {
        alert("사용자 정보를 확인할 수 없습니다. 다시 로그인해주세요.");
        return;
      }

      // 이미 로딩 중인 경우 중복 요청 방지
      if (isStoryLoading || isSelectionLoading) {
        console.log("Story or selection is already loading, ignoring click");
        return;
      }

      // 이 시점에서 thread는 null이 아님이 보장됨
      const currentThread = thread;

      console.log("Processing selection:", selection);

      // 선택지 로딩 상태 시작
      setIsSelectionLoading(true);
      setSelectedChoice(selection);
      setIsStoryLoading(true);
      setSelections([]);

      // 이미지는 첫 번째 생성 시에만 만들어지므로 추가 설정 불필요
      // if (isImageIncluded) {
      //   setIsImageLoading(false); // 실제 이미지 생성 직전에 true로 설정
      // }

      // LangChain으로 다음 전개 생성
      const { storyHtml, messages: updatedMessages } = await generateNextPart(
        rawText,
        selection,
        langchainMessages.length > 0
          ? deserializeMessages(langchainMessages)
          : [],
      );

      // 응답 검증
      if (!storyHtml || typeof storyHtml !== "string") {
        throw new Error("Invalid story HTML response");
      }

      if (updatedMessages) {
        // 직렬화 가능한 형태로 메시지 저장
        setLangchainMessages(serializeMessages(updatedMessages));
      }

      await threadApi.updateThread({
        thread_id: currentThread.id,
        user_id: userInfo.id,
        raw_text: rawText + storyHtml,
      });

      setRawText(rawText + storyHtml);

      // HTML에서 정보 추출
      const {
        messages: newMessages,
        selections: newSelections,
        notice: newNotice,
      } = extractInfoFromHTML(storyHtml);

      // 추출된 데이터 검증
      if (!Array.isArray(newMessages)) {
        console.warn("Invalid messages extracted from HTML");
      }
      if (!Array.isArray(newSelections)) {
        console.warn("Invalid selections extracted from HTML");
      }

      // 영어 번역 처리
      let finalMessages = newMessages;
      if (isEnglishIncluded && newMessages.length > 0) {
        try {
          // 모든 한국어 메시지 추출
          const koreanTexts = newMessages.map(msg => msg.korean).join("\n\n");
          // 영어로 번역
          const englishTranslation = await translateToEnglish(koreanTexts);
          // 영어 번역 통합
          const combinedHtml = await integrateEnglishTranslation(
            storyHtml,
            englishTranslation,
          );

          // 통합된 HTML에서 정보 재추출
          const extractedInfo = extractInfoFromHTML(combinedHtml);
          finalMessages = extractedInfo.messages;

          // 선택지도 업데이트
          newSelections.forEach((selection, index) => {
            if (index < extractedInfo.selections.length) {
              selection.english = extractedInfo.selections[index].english;
            }
          });
        } catch (translationError) {
          console.error("Translation error:", translationError);
          // 번역 실패 시 원본 메시지 사용
          finalMessages = newMessages;
        }
      }

      // 메시지 저장
      if (finalMessages.length > 0) {
        const messageObjects = finalMessages.map(msg => ({
          korean: msg.korean,
          english: msg.english || "",
        }));

        const savedMessages = await messagesApi.saveMessages({
          messages: messageObjects,
          thread_id: currentThread.id,
          turn,
        });

        const messageMaps = savedMessages.map((item: Message) => ({
          text: item.message,
          text_en: item.message_en,
        }));

        setMessages([...messages, ...messageMaps]);
      }

      // 선택지 업데이트
      if (newSelections.length > 0) {
        setSelections(
          newSelections.map(s => ({
            text: s.korean,
            text_en: s.english || "",
          })),
        );
      }

      setNotice(newNotice || "");
      setTurn(turn + 1);

      // 이야기 로딩 완료 표시
      setIsStoryLoading(false);
      setIsSelectionLoading(false);
      setSelectedChoice("");

      // 이미지는 첫 번째 동화 생성 시에만 생성하므로 추가 생성하지 않음
      // if (isImageIncluded && finalMessages.length > 0) {
      //   setIsImageLoading(true);
      //   try {
      //     // 새로 추가된 동화 내용을 이미지 생성에 사용
      //     const newStoryText = finalMessages
      //       .map(msg => msg.korean)
      //       .join("\n\n");
      //     await getImage(newStoryText, currentThread.id);
      //   } catch (imageError) {
      //     console.error("Image generation error:", imageError);
      //   } finally {
      //     setIsImageLoading(false);
      //   }
      // }
    } catch (error) {
      console.error("Error continuing story:", error);
      alert("이야기 진행 중 오류가 발생했습니다. 다시 시도해주세요.");
      setIsStoryLoading(false);
      setIsSelectionLoading(false);
      setSelectedChoice("");
    }
  }

  async function getImage(storyContent: string, thread_id: number) {
    try {
      const response = await generateImage(storyContent);
      const imageData = await imageApi.uploadImage(
        response.data?.[0]?.b64_json ?? "",
        thread_id,
      );
      setImages([...images, URL.createObjectURL(imageData!)]);

      // 이미지 저장 후 has_image 플래그 업데이트
      await threadApi.updateThread({
        thread_id,
        user_id: userInfo.id,
        has_image: true,
      });
    } catch (error) {
      console.error("Error fetching image:", error);
    }
  }

  // HTML에서 정보를 추출하는 유틸리티 함수
  function extractInfoFromHTML(htmlString: string) {
    try {
      // 입력 검증
      if (!htmlString || typeof htmlString !== "string") {
        console.error("Invalid HTML string:", htmlString);
        return {
          messages: [],
          selections: [],
          notice: "",
        };
      }

      // 섹션별로 HTML 문자열 분리
      const messagesSectionMatch = htmlString.match(
        /<ul class="messages">([\s\S]*?)<\/ul>/,
      );
      const selectionsSectionMatch = htmlString.match(
        /<ol class="selections">([\s\S]*?)<\/ol>/,
      );

      // 동화내용 추출
      const messages: MessagePair[] = [];
      if (messagesSectionMatch && messagesSectionMatch[1]) {
        try {
          const messagesHtml = messagesSectionMatch[1];
          const messageRegex =
            /<li class="korean">(.+?)<\/li>(\s*<li class="english">(.+?)<\/li>)?/g;
          let messageMatch;
          while ((messageMatch = messageRegex.exec(messagesHtml)) !== null) {
            if (messageMatch[1] && messageMatch[1].trim()) {
              messages.push({
                korean: messageMatch[1].trim(),
                english: messageMatch[3] ? messageMatch[3].trim() : "", // 영어 메시지가 없으면 빈 문자열 사용
              });
            }
          }
        } catch (messageError) {
          console.error("Error extracting messages:", messageError);
        }
      }

      // 선택지 추출
      const selections: MessagePair[] = [];
      if (selectionsSectionMatch && selectionsSectionMatch[1]) {
        try {
          const selectionsHtml = selectionsSectionMatch[1];
          const selectionRegex =
            /<li class="korean">(.+?)<\/li>(\s*<li class="english">(.+?)<\/li>)?/g;
          let selectionMatch;
          while (
            (selectionMatch = selectionRegex.exec(selectionsHtml)) !== null
          ) {
            if (selectionMatch[1] && selectionMatch[1].trim()) {
              selections.push({
                korean: selectionMatch[1].trim(),
                english: selectionMatch[3] ? selectionMatch[3].trim() : "", // 영어 선택지가 없으면 빈 문자열 사용
              });
            }
          }
        } catch (selectionError) {
          console.error("Error extracting selections:", selectionError);
        }
      }

      // 안내메시지 추출
      let notice = "";
      try {
        const noticeRegex = /<p class="notice">(.+?)<\/p>/;
        const noticeMatch = noticeRegex.exec(htmlString);
        notice = noticeMatch && noticeMatch[1] ? noticeMatch[1].trim() : "";
      } catch (noticeError) {
        console.error("Error extracting notice:", noticeError);
      }

      console.log("Extracted from HTML:", {
        messagesCount: messages.length,
        selectionsCount: selections.length,
        notice,
      });

      return {
        messages,
        selections,
        notice,
      };
    } catch (error) {
      console.error("Error in extractInfoFromHTML:", error);
      return {
        messages: [],
        selections: [],
        notice: "",
      };
    }
  }

  // 단어에 대한 인터페이스 추가
  interface MessagePair {
    korean: string;
    english: string;
  }

  // 한국어 동화를 영어로 번역하는 함수
  async function translateStory() {
    if (!isStarted || messages.length === 0 || !thread?.id) return;

    setTranslationInProgress(true);
    try {
      // 현재 한국어 메시지만 추출
      const koreanMessages = messages.map(msg => msg.text).join("\n\n");

      // LangChain 번역 함수 호출
      const englishTranslation = await translateToEnglish(koreanMessages);

      // HTML 형식으로 변환
      const koreanHtml = `<ul class="messages">
        ${messages.map(msg => `<li class="korean">${msg.text}</li>`).join("\n")}
      </ul>`;

      // 번역된 영어와 한국어 HTML 통합
      const combinedHtml = await integrateEnglishTranslation(
        koreanHtml,
        englishTranslation,
      );

      // 통합된 HTML에서 메시지 추출
      const { messages: translatedMessages } =
        extractInfoFromHTML(combinedHtml);

      // 추출된 메시지로 상태 업데이트
      const updatedMessages = messages.map((msg, index) => ({
        ...msg,
        text_en:
          index < translatedMessages.length
            ? translatedMessages[index].english
            : msg.text_en,
      }));

      // 상태 업데이트
      setMessages(updatedMessages);

      // 번역된 메시지를 데이터베이스에 저장
      await messagesApi.updateMessagesWithTranslation(
        updatedMessages.map((msg, index) => ({
          message: msg.text,
          message_en: msg.text_en,
          turn,
          thread_id: thread.id, // thread가 null이 아님을 위에서 확인했으므로 안전
          position: index,
        })),
      );

      // 영어 표시 활성화
      setIsShowEnglish(true);
      setIsEnglishIncluded(true);
    } catch (error) {
      console.error("Error translating story:", error);
      alert("번역 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setTranslationInProgress(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <div className="w-full max-w-2xl">
        <div className="flex flex-col gap-4">
          {userInfo.id ? (
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
                  onEnglishIncludedChange={e =>
                    setIsEnglishIncluded(e.target.checked)
                  }
                  onImageIncludedChange={e =>
                    setIsImageIncluded(e.target.checked)
                  }
                />
              </div>
              {/* 이미지 로딩 표시가 먼저 나타나도록 변경 */}
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
                  {/* 이미지 영역 - 이야기 위에 배치 */}
                  {isImageIncluded && (
                    <div className="mb-4">
                      <h2 className="mb-2 text-xl">동화 이미지</h2>
                      <div className="grid grid-cols-1 gap-2">
                        {images.map((src, index) => (
                          <img
                            key={index}
                            src={src}
                            className="w-full rounded-md"
                            alt={`동화 이미지 ${index + 1}`}
                          />
                        ))}
                        {/* 첫 번째 동화 생성 시에만 이미지 로딩 표시 */}
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

                  {/* 이야기 로딩은 이미지 영역 아래에 배치 */}
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

                  {/* 이야기 영역 - 이미지 아래로 이동 */}
                  {messages && messages.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <h2 className="text-xl">동화 내용</h2>
                        {isEnglishIncluded && (
                          <button
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
                        useGoogleTTS // Google Translate TTS 사용 (무료)
                      />
                    </div>
                  )}

                  {/* 선택지 진행 중 이야기 로딩 표시 - 기존 이야기 아래, 선택지 위에 배치 */}
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

                  {selections && selections.length > 0 && (
                    <div className="mb-4">
                      <h2 className="mb-2 text-xl">다음 전개를 선택하세요</h2>
                      <SelectionDisplay
                        selections={selections}
                        isShowEnglish={isShowEnglish}
                        onSelectionClick={clickSelection}
                        notice={notice}
                        onClear={() => {}}
                        selectedChoice={selectedChoice}
                        isSelectionLoading={isSelectionLoading}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <GuideForSign />
          )}
        </div>
      </div>
    </div>
  );
}
