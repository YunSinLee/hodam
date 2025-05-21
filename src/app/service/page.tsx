"use client";

import { useEffect, useMemo, useState } from "react";
// LangChain 함수 import
import {
  generateFairyTale,
  generateNextPart,
  translateToEnglish,
  integrateEnglishTranslation,
  generateImage,
} from "../api/langchain";
import {
  HumanMessage,
  SystemMessage,
  AIMessage,
} from "@langchain/core/messages";

import { Message, Thread, Selection } from "../types/openai";
import { isEmpty } from "../utils";

import threadApi from "@/app/api/thread";
import keywordsApi from "@/app/api/keywords";
import messagesApi from "@/app/api/messages";
import imageApi from "@/app/api/image";
import userApi from "@/app/api/user";
import beadApi from "../api/bead";
import useUserInfo from "@/services/hooks/use-user-info";
import useBead from "@/services/hooks/use-bead";

import KeywordInput from "@/app/components/KeywordInput";
import MessageDisplay from "@/app/components/MessageDisplay";
import SelectionDisplay from "@/app/components/SelectionDisplay";
import GuideForSign from "@/app/components/GuideForSign";
import HButton from "@/app/components/atomic/HButton";

export default function Hodam() {
  const [thread, setThread] = useState<Thread>({} as Thread);
  const [keywords, setKeywords] = useState<string>("");
  const [rawText, setRawText] = useState<string>("");
  const [messages, setMessages] = useState<{ text: string; text_en: string }[]>(
    [],
  );
  const [notice, setNotice] = useState<string>("");
  const [selections, setSelections] = useState<
    { text: string; text_en: string }[]
  >([]);
  const [imageDescription, setImageDescription] = useState<string>("");
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
  // 대화 기록 유지를 위한 상태
  const [langchainMessages, setLangchainMessages] = useState<
    (HumanMessage | AIMessage | SystemMessage)[]
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

  useEffect(() => {
    if (userInfo.id) startThread();
  }, [userInfo.id]);

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
    // 새로운 스레드 생성
    const thread = await threadApi.createThread({
      thread_id: `langchain_${Date.now()}`, // 임의의 ID 생성
      user_id: userInfo.id,
    });
    setThread(thread);
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

  async function searchKeywords() {
    await consumeBeads();
    setIsStarted(true);
    setIsStoryLoading(true);

    // 시작부터 이미지 생성이 포함되어 있음을 표시
    if (isImageIncluded) {
      setIsImageLoading(false); // 플래그는 이미지 생성 직전에 true로 설정되므로, 초기에는 false로 둠
    }

    try {
      await threadApi.updateThread({
        thread_id: thread.id,
        user_id: userInfo.id,
        able_english: isEnglishIncluded,
        has_image: isImageIncluded,
      });

      // 키워드 저장
      const keywordArray = keywords.split(",").map(k => k.trim());
      await keywordsApi.saveKeywords({
        keywords: keywordArray,
        thread_id: thread.id,
      });

      // LangChain으로 동화 생성
      const {
        storyHtml,
        storytellingPrompt,
        messages: updatedMessages,
      } = await generateFairyTale(keywords);

      if (updatedMessages) {
        setLangchainMessages(updatedMessages);
      }

      await threadApi.updateThread({
        thread_id: thread.id,
        user_id: userInfo.id,
        raw_text: storyHtml,
      });

      setRawText(storyHtml);

      // HTML에서 정보 추출
      const {
        messages: newMessages,
        selections: newSelections,
        notice: newNotice,
        imageDescription: newImageDescription,
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
        thread_id: thread.id,
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
      if (isImageIncluded && storytellingPrompt) {
        setImageDescription(storytellingPrompt);
        setIsImageLoading(true);
        getImage(storytellingPrompt).finally(() => {
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
    setIsStoryLoading(true);
    setSelections([]);

    // 이미지 생성이 포함되어 있으면 초기 상태 설정
    if (isImageIncluded) {
      setIsImageLoading(false); // 실제 이미지 생성 직전에 true로 설정
    }

    try {
      // LangChain으로 다음 전개 생성
      const {
        storyHtml,
        storytellingPrompt,
        messages: updatedMessages,
      } = await generateNextPart(rawText, selection, langchainMessages);

      if (updatedMessages) {
        setLangchainMessages(updatedMessages);
      }

      await threadApi.updateThread({
        thread_id: thread.id,
        user_id: userInfo.id,
        raw_text: rawText + storyHtml,
      });

      setRawText(rawText + storyHtml);

      // HTML에서 정보 추출
      const {
        messages: newMessages,
        selections: newSelections,
        notice: newNotice,
        imageDescription: newImageDescription,
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
        thread_id: thread.id,
        turn,
      });

      const messageMaps = savedMessages.map((item: Message) => ({
        text: item.message,
        text_en: item.message_en,
      }));

      setMessages([...messages, ...messageMaps]);
      setSelections(
        newSelections.map(s => ({
          text: s.korean,
          text_en: s.english || "",
        })),
      );
      setNotice(newNotice);
      setTurn(turn + 1);

      // 이야기 로딩 완료 표시
      setIsStoryLoading(false);

      // 이미지 생성은 이야기 로딩 완료 후 비동기적으로 처리
      if (isImageIncluded && storytellingPrompt) {
        setImageDescription(storytellingPrompt);
        setIsImageLoading(true);
        getImage(storytellingPrompt).finally(() => {
          setIsImageLoading(false);
        });
      }
    } catch (error) {
      console.error("Error continuing story:", error);
      alert("이야기 진행 중 오류가 발생했습니다. 다시 시도해주세요.");
      setIsStoryLoading(false);
    }
  }

  async function getImage(description: string) {
    try {
      const response = await generateImage(description);
      const imageData = await imageApi.uploadImage(
        response.data?.[0]?.b64_json ?? "",
        thread.id,
      );
      setImages([...images, URL.createObjectURL(imageData!)]);
    } catch (error) {
      console.error("Error fetching image:", error);
    }
  }

  // HTML에서 정보를 추출하는 유틸리티 함수
  function extractInfoFromHTML(htmlString: string) {
    // 섹션별로 HTML 문자열 분리
    const messagesSectionMatch = htmlString.match(
      /<ul class="messages">([\s\S]*?)<\/ul>/,
    );
    const selectionsSectionMatch = htmlString.match(
      /<ol class="selections">([\s\S]*?)<\/ol>/,
    );

    // 동화내용 추출
    const messages: MessagePair[] = [];
    if (messagesSectionMatch) {
      const messagesHtml = messagesSectionMatch[1];
      const messageRegex =
        /<li class="korean">(.+?)<\/li>(\s*<li class="english">(.+?)<\/li>)?/g;
      let messageMatch;
      while ((messageMatch = messageRegex.exec(messagesHtml)) !== null) {
        messages.push({
          korean: messageMatch[1],
          english: messageMatch[3] || "", // 영어 메시지가 없으면 빈 문자열 사용
        });
      }
    }

    // 선택지 추출
    const selections: MessagePair[] = [];
    if (selectionsSectionMatch) {
      const selectionsHtml = selectionsSectionMatch[1];
      const selectionRegex =
        /<li class="korean">(.+?)<\/li>(\s*<li class="english">(.+?)<\/li>)?/g;
      let selectionMatch;
      while ((selectionMatch = selectionRegex.exec(selectionsHtml)) !== null) {
        selections.push({
          korean: selectionMatch[1],
          english: selectionMatch[3] || "", // 영어 선택지가 없으면 빈 문자열 사용
        });
      }
    }

    // 안내메시지 추출
    const noticeRegex = /<p class="notice">(.+?)<\/p>/;
    const noticeMatch = noticeRegex.exec(htmlString);
    const notice = noticeMatch ? noticeMatch[1] : "";

    // 이미지 설명 추출
    const imageDescriptionRegex = /<p class="image">(.+?)<\/p>/;
    const imageDescriptionMatch = imageDescriptionRegex.exec(htmlString);
    const imageDescription = imageDescriptionMatch
      ? imageDescriptionMatch[1]
      : "";

    return {
      messages,
      selections,
      notice,
      imageDescription,
    };
  }

  // 단어에 대한 인터페이스 추가
  interface MessagePair {
    korean: string;
    english: string;
  }

  // 한국어 동화를 영어로 번역하는 함수
  async function translateStory() {
    if (!isStarted || messages.length === 0) return;

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
          thread_id: thread.id,
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
                  ></div>
                  <span>영어 번역 포함</span>
                  <div
                    className={`w-5 h-5 rounded-full ${
                      isImageIncluded ? "bg-orange-500" : "bg-gray-300"
                    }`}
                    onClick={() => setIsImageIncluded(!isImageIncluded)}
                  ></div>
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
              {isImageIncluded && isStoryLoading && (
                <div className="flex justify-center mb-4">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
                    <p className="mt-2 text-blue-500">이미지 생성 중...</p>
                  </div>
                </div>
              )}
              {isStarted && (
                <>
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
                          {/* 이미 생성된 이미지만 표시하고, 로딩은 위에서 표시 */}
                          {isImageLoading && !isStoryLoading && (
                            <div className="relative w-full pb-[100%] bg-gray-100 rounded-md">
                              <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <div className="w-10 h-10 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
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
                    {isStoryLoading && (
                      <div className="flex justify-center mb-4">
                        <div className="flex flex-col items-center">
                          <div className="w-10 h-10 border-4 border-orange-500 rounded-full border-t-transparent animate-spin"></div>
                          <p className="mt-2 text-orange-500">
                            이야기 생성 중...
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
                              {isShowEnglish
                                ? "한국어만 보기"
                                : "영어 함께 보기"}
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
                          useGoogleTTS={true} // Google Translate TTS 사용 (무료)
                        />
                      </div>
                    )}

                    {notice && <p className="mb-4 text-orange-500">{notice}</p>}

                    {selections && selections.length > 0 && (
                      <div className="mb-4">
                        <h2 className="mb-2 text-xl">다음 전개를 선택하세요</h2>
                        <SelectionDisplay
                          selections={selections}
                          isShowEnglish={isShowEnglish}
                          clickSelection={clickSelection}
                          notice={notice}
                        />
                      </div>
                    )}
                  </div>
                </>
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
