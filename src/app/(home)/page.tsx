"use client";

import { useState } from "react";
import {
  createThread,
  addMessageToThread,
  run,
  retrieveRun,
  getText,
  createImage,
} from "../../services/actions/openai";
import styles from "./page.module.scss";

import keywordsApi from "../api/keywords";
import messagesApi from "../api/messages";

export default function Hodam() {
  const [threadId, setThreadId] = useState<string>("");
  const [keywords, setKeywords] = useState<string>("");
  const [messages, setMessages] = useState<{ text: string }[]>([]);
  const [notice, setNotice] = useState<string>("");
  const [selections, setSelections] = useState<{ text: string }[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [images, setImages] = useState<string[]>([]);

  function inputKeywords(e: React.ChangeEvent<HTMLInputElement>) {
    const { value } = e.target;
    setKeywords(value);
  }

  async function startThread() {
    const response = await createThread();

    setThreadId(response.id);
  }

  async function searchKeywords() {
    setIsLoading(true);
    await addMessageToThread(threadId, keywords);

    const keywordArray = keywords.split(",");
    keywordsApi.saveKeywords({ keywords: keywordArray, thread_id: threadId });

    const response = await run(threadId);

    // setRunId(response.id);

    checkStatusWithInterval(response.id);
  }

  async function clickSelection(selection: string, index: number) {
    setIsLoading(true);
    if (index === 3) {
      const response = await createImage(selection);

      const imageUrls = response.data.map(data => data.url ?? "");
      setImages(imageUrls);
      setIsLoading(false);
    } else {
      setSelections([]);
      await addMessageToThread(threadId, selection);

      const response = await run(threadId);

      checkStatusWithInterval(response.id);
    }
  }

  async function checkStatusWithInterval(runId: string) {
    const interval = 5000; // 5 seconds in milliseconds

    async function check() {
      const response = await retrieveRun(threadId, runId);
      const currentStatus = response.status;
      console.log("runStatus", currentStatus);
      if (currentStatus === "completed") {
        const { ulItems, olItems, pContents } = await getText(threadId);
        messagesApi.saveMessages({
          messages: ulItems.map(item => item.text),
          thread_id: threadId,
          keywords: keywords.split(","),
        });
        messages.length
          ? setMessages([...messages, ...ulItems])
          : setMessages([...ulItems]);
        pContents.length && setNotice(pContents[0]);
        setSelections([...olItems]);

        setIsLoading(false);
      } else {
        setTimeout(check, interval); // Call check again after interval
      }
    }

    await check(); // Initial call to check
  }

  return (
    <div>
      {!threadId && <button onClick={startThread}>시작하기</button>}
      {threadId && (
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
            {images.map(image => (
              <img className={styles.image} src={image} />
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
