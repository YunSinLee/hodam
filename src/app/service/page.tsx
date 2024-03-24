"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createThread,
  addMessageToThread,
  run,
  retrieveRun,
  getExtractedText,
  createImage,
} from "../../services/actions/openai";
import styles from "./page.module.scss";
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

export default function Hodam() {
  const [thread, setThread] = useState<Thread>({} as Thread);
  const [keywords, setKeywords] = useState<string>("");
  const [messages, setMessages] = useState<{ text: string; text_en: string }[]>(
    [],
  );
  const [notice, setNotice] = useState<string>("");
  const [selections, setSelections] = useState<
    { text: string; text_en: string }[]
  >([]);
  const [imageDescription, setImageDescription] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [images, setImages] = useState<string[]>([]);
  const [turn, setTurn] = useState<number>(0);
  const [assistantType, setAssistantType] = useState<"default" | "traditional">(
    "default",
  );
  const [isEnglishIncluded, setIsEnglishIncluded] = useState<boolean>(false);
  const [isShowEnglish, setIsShowEnglish] = useState<boolean>(false);
  const [isImageIncluded, setIsImageIncluded] = useState<boolean>(false);
  const [isStarted, setIsStarted] = useState<boolean>(false);

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
    console.log("재실행");
  }, [userInfo.id]);

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
    const response = await createThread();

    const thread = await threadApi.createThread({
      thread_id: response.id,
      user_id: userInfo.id,
    });

    setThread(thread);
  }

  async function consumeBeads() {
    if (!userInfo.id || bead.count === undefined) return;

    if (bead.count < neededBeadCount) {
      alert("구슬이 부족합니다.");
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
    setIsLoading(true);
    await addMessageToThread(thread.openai_thread_id, keywords);

    const keywordArray = keywords.split(",");
    keywordsApi.saveKeywords({
      keywords: keywordArray,
      thread_id: thread.id,
    });

    const response = await run(thread.openai_thread_id, assistantType);

    checkStatusWithInterval(response.id);
  }

  async function clickSelection(selection: string) {
    setIsLoading(true);

    setSelections([]);
    await addMessageToThread(thread.openai_thread_id, selection);

    const response = await run(thread.openai_thread_id, assistantType);

    checkStatusWithInterval(response.id);
  }

  async function getImage(description: string) {
    console.log("이미지디스크립션", description);
    const response = await createImage(description);

    const imageUrls = response.data.map(data => data.url ?? "");
    setImages(imageUrls);
    await imageApi.saveImage({
      image_url: imageUrls[0],
      thread_id: thread.id,
      turn,
      description,
    });
  }

  async function checkStatusWithInterval(runId: string) {
    const interval = 5000; // 5 seconds in milliseconds

    async function check() {
      const response = await retrieveRun(thread.openai_thread_id, runId);
      const currentStatus = response.status;
      if (currentStatus === "completed") {
        const {
          messages: newMessages,
          selections: newSelections,
          notice: newNotice,
          imageDescription: newImageDescription,
        } = await getExtractedText(thread.openai_thread_id);

        const savedMessages = await messagesApi.saveMessages({
          messages: newMessages,
          thread_id: thread.id,
          turn,
        });
        const messageMaps = savedMessages.map((item: Message) => ({
          text: item.message,
          text_en: item.message_en,
        }));
        messages.length
          ? setMessages([...messages, ...messageMaps])
          : setMessages([...messageMaps]);
        newNotice && setNotice(newNotice);
        const savedSelections = await messagesApi.saveSelections({
          selections: newSelections,
          thread_id: thread.id,
          turn,
        });
        const selectionMaps = savedSelections.map((item: Selection) => ({
          text: item.selection,
          text_en: item.selection_en,
        }));
        setSelections([...selectionMaps]);
        console.log("이미지1", newImageDescription);
        setImageDescription(newImageDescription);
        if (turn === 0 && isImageIncluded) {
          await getImage(newImageDescription);
        }
        setTurn(turn + 1);
        // }

        setIsLoading(false);
      } else {
        setTimeout(check, interval); // Call check again after interval
      }
    }

    await check(); // Initial call to check
  }

  return (
    <div>
      {isEmpty(thread) && (
        <button
          onClick={startThread}
          className="text-xl px-4 py-2 bg-orange-500 hover:bg-orange-700 text-white bturn bturn-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 shadow"
        >
          시작하기
        </button>
      )}
      {!isEmpty(thread) && (
        <div className="max-w-screen-lg flex flex-col items-center mx-auto">
          {isStarted ? null : (
            <KeywordInput
              neededBeadCount={neededBeadCount}
              keywords={keywords}
              assistantType={assistantType}
              isEnglishIncluded={isEnglishIncluded}
              isImageIncluded={isImageIncluded}
              onKeywordsChange={inputKeywords}
              onButtonClicked={searchKeywords}
              onAssistantTypeChange={(
                e: React.ChangeEvent<HTMLSelectElement>,
              ) =>
                setAssistantType(e.target.value as "default" | "traditional")
              }
              onEnglishIncludedChange={(
                e: React.ChangeEvent<HTMLInputElement>,
              ) => setIsEnglishIncluded(e.target.checked)}
              onImageIncludedChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setIsImageIncluded(e.target.checked)
              }
            />
          )}
          {messages.length > 0 ? (
            <div>
              {isEnglishIncluded ? (
                <label>
                  <input
                    type="checkbox"
                    checked={isShowEnglish}
                    onChange={() => setIsShowEnglish(!isShowEnglish)}
                  />
                  영어 보이기
                </label>
              ) : null}
              <div className="flex gap-12">
                <div className="flex-1">
                  <MessageDisplay
                    messages={messages}
                    isShowEnglish={isShowEnglish}
                  />
                </div>
                <div className="max-w-80">
                  <SelectionDisplay
                    selections={selections}
                    isShowEnglish={isShowEnglish}
                    clickSelection={clickSelection}
                    notice={notice}
                  />
                </div>
              </div>
            </div>
          ) : null}
          {/* {imageDescription.length > 0 ? (
            <button
              className="flex gap-2 text-left text-xl leading-8 px-4 py-2 bg-orange-500 hover:bg-orange-700 text-white border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 shadow"
              onClick={getImage}
            >
              <span>{4}. </span>
              <span>그림을 그려보아요</span>
            </button>
          ) : null} */}
          <div className={styles.imageContainer}>
            {images.map((image, i) => (
              <img className={styles.image} src={image} key={i} />
            ))}
          </div>

          {!messages.length && isLoading && (
            <h4 className={styles.loadingContainer}>
              이야기 여행을 준비하는 중...
            </h4>
          )}
          {!!messages.length && isLoading && (
            <h4 className={styles.loadingContainer}>
              다음 이야기로 여행하는 중...
            </h4>
          )}
        </div>
      )}
    </div>
  );
}
