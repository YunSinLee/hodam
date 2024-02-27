"use client";

import { useState } from "react";
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

import threadApi from "../api/thread";
import keywordsApi from "../api/keywords";
import messagesApi from "../api/messages";

export default function Hodam() {
  const [thread, setThread] = useState<Thread>({} as Thread);
  const [keywords, setKeywords] = useState<string>("");
  const [messages, setMessages] = useState<{ text: string }[]>([]);
  const [notice, setNotice] = useState<string>("");
  const [selections, setSelections] = useState<{ text: string }[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [images, setImages] = useState<string[]>([]);
  const [order, setOrder] = useState<number>(0);

  function inputKeywords(e: React.ChangeEvent<HTMLInputElement>) {
    const { value } = e.target;
    setKeywords(value);
  }

  async function startThread() {
    const response = await createThread();

    const thread = await threadApi.createThread({ thread_id: response.id });

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
      console.log("runStatus", currentStatus);
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
            order,
          });
          messages.length
            ? setMessages([...messages, ...ulItems])
            : setMessages([...ulItems]);
          pContents.length && setNotice(pContents[0]);
          setSelections([...olItems]);
          setOrder(order + 1);
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
      {isEmpty(thread) && <button onClick={startThread}>시작하기</button>}
      {!isEmpty(thread) && (
        <div>
          <div className={styles.searchContainer}>
            <input
              className={styles.searchInput}
              type="text"
              value={keywords}
              onChange={inputKeywords}
            />
            <button className={styles.searchButton} onClick={searchKeywords}>
              알려줘
            </button>
          </div>
          <div className={styles.messageContainer}>
            {messages.map((message, index) => (
              <p className={styles.message} key={index}>
                {message.text}
              </p>
            ))}
          </div>
          <h2>{notice}</h2>
          <div className={styles.selectionContainer}>
            {selections.map((selection, index) => (
              <button
                className={styles.selection}
                key={index}
                onClick={() => clickSelection(selection.text, index)}
              >
                {index + 1}.{selection.text}
              </button>
            ))}
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