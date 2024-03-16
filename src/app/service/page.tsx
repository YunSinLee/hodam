"use client";

import { useEffect, useState } from "react";
import {
  createThread,
  addMessageToThread,
  run,
  retrieveRun,
  getText,
  getExtractedText,
  createImage,
} from "../../services/actions/openai";
import styles from "./page.module.scss";
import { Thread } from "../types/openai";
import { isEmpty } from "../utils";

import threadApi from "@/app/api/thread";
import keywordsApi from "@/app/api/keywords";
import messagesApi from "@/app/api/messages";
import userApi from "@/app/api/user";
import useUserInfo from "@/services/hooks/use-user-info";

import KeywordInput from "@/app/components/KeywordInput";
import MessageDisplay from "@/app/components/MessageDisplay";
import SelectionDisplay from "@/app/components/SelectionDisplay";

export default function Hodam() {
  const [thread, setThread] = useState<Thread>({} as Thread);
  const [keywords, setKeywords] = useState<string>("");
  const [messages, setMessages] = useState<{ text: string }[]>([]);
  const [notice, setNotice] = useState<string>("");
  const [selections, setSelections] = useState<{ text: string }[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [images, setImages] = useState<string[]>([]);
  const [turn, setTurn] = useState<number>(0);

  const { userInfo, setUserInfo } = useUserInfo();

  useEffect(() => {
    getSession();
  }, []);

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

  async function searchKeywords() {
    setIsLoading(true);
    await addMessageToThread(thread.openai_thread_id, keywords);

    const keywordArray = keywords.split(",");
    keywordsApi.saveKeywords({
      keywords: keywordArray,
      thread_id: thread.id,
    });

    const response = await run(thread.openai_thread_id);

    checkStatusWithInterval(response.id);
  }

  async function clickSelection(selection: string, index: number) {
    setIsLoading(true);

    setSelections([]);
    await addMessageToThread(thread.openai_thread_id, selection);

    const response = await run(thread.openai_thread_id);

    checkStatusWithInterval(response.id, index === 3);
  }

  async function checkStatusWithInterval(runId: string, isImage = false) {
    const interval = 5000; // 5 seconds in milliseconds

    async function check() {
      const response = await retrieveRun(thread.openai_thread_id, runId);
      const currentStatus = response.status;
      if (currentStatus === "completed") {
        if (isImage) {
          const prompt = await getText(thread.openai_thread_id);
          const response = await createImage(prompt);

          const imageUrls = response.data.map(data => data.url ?? "");
          setImages(imageUrls);
        } else {
          const { ulItems, olItems, pContents } = await getExtractedText(
            thread.openai_thread_id,
          );
          messagesApi.saveMessages({
            messages: ulItems.map(item => item.text),
            thread_id: thread.id,
            turn,
          });
          messages.length
            ? setMessages([...messages, ...ulItems])
            : setMessages([...ulItems]);
          pContents.length && setNotice(pContents[0]);
          setSelections([...olItems]);
          setTurn(turn + 1);
        }

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
          {/* <div className="flex items-center gap-8">
            <input
              className="form-input text-3xl flex-1 px-4 py-2 bturn bturn-gray-300 rounded-md focus:outline-none focus:bturn-orange-500 focus:ring-1 focus:ring-orange-500 shadow-sm"
              type="text"
              value={keywords}
              onChange={inputKeywords}
            />
            <button
              className="text-3xl px-4 py-2 bg-orange-500 hover:bg-orange-700 text-white bturn bturn-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 shadow"
              onClick={searchKeywords}
            >
              알려줘
            </button>
          </div> */}
          <KeywordInput
            keywords={keywords}
            onKeywordsChange={inputKeywords}
            onButtonClicked={searchKeywords}
          />
          <div className="flex gap-12">
            <div className="flex-1">
              <MessageDisplay messages={messages} />
            </div>
            <div className="max-w-80">
              <SelectionDisplay
                selections={selections}
                clickSelection={clickSelection}
                notice={notice}
              />
            </div>
          </div>
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
