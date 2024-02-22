"use client";

import { useState } from "react";
import {
  createThread,
  addMessageToThread,
  run,
  retrieveRun,
  getText,
} from "../../services/actions/openai";
import styles from "./page.module.scss";

export default function Hodam() {
  const [threadId, setThreadId] = useState<string>("");
  const [keywords, setKeywords] = useState<string>("");
  const [messages, setMessages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

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

    const response = await run(threadId);

    // setRunId(response.id);

    checkStatusWithInterval(response.id);
  }

  // async function checkStatus() {
  //   const response = await retrieveRun(threadId, runId);
  //   setRunStatus(response.status);

  //   if (runStatus === "completed") {
  //     const messages = await getText(threadId);

  //     setMessage(messages);
  //   }
  // }

  async function checkStatusWithInterval(runId: string) {
    const interval = 5000; // 5 seconds in milliseconds

    async function check() {
      const response = await retrieveRun(threadId, runId);
      const currentStatus = response.status;
      console.log("runStatus", currentStatus);
      if (currentStatus === "completed") {
        const text = await getText(threadId);
        messages.length
          ? setMessages([...messages, text])
          : setMessages([text]);

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
                {message}
              </p>
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
