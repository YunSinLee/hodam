"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import threadApi from "@/app/api/thread";
import messagesApi from "@/app/api/messages";
import imageApi from "@/app/api/image";
import type { Message, Thread } from "@/app/types/openai";
import MessageDisplay from "@/app/components/MessageDisplay";

export default function MyStoryDetail() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [thread, setThread] = useState<Thread>({} as Thread);
  const [messages, setMessages] = useState<{ text: string; text_en: string }[]>(
    [],
  );
  const [isShowEnglish, setIsShowEnglish] = useState<boolean>(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const params = useParams();

  async function getThread() {
    const thread = await threadApi.getThreadByID(Number(params.thread_id));

    setThread(thread);
  }

  async function fetchMessages() {
    setIsLoading(true);
    const data = await messagesApi.fetchMessages({
      thread_ids: [Number(params.thread_id)],
    });
    const targetMessage = data[Number(params.thread_id)];
    if (targetMessage) {
      const texts = targetMessage.map((message: Message) => {
        return { text: message.message, text_en: message.message_en };
      });
      setMessages(texts);
    }
    setIsLoading(false);
    console.log(messages.length);
  }

  async function fetchImage() {
    const imageUrl = await imageApi.getImage({
      thread_id: Number(params.thread_id),
    });
    setImageUrl(imageUrl);
  }

  useEffect(() => {
    getThread();
    fetchMessages();
    fetchImage();
  }, []);

  return (
    <div>
      <h1>MyStoryDetail</h1>
      <p>{params.thread_id}</p>
      {isLoading ? (
        <div>Loading...</div>
      ) : messages.length === 0 ? (
        <div>No messages</div>
      ) : (
        <div>
          {thread.able_english ? (
            <label>
              <input
                type="checkbox"
                checked={isShowEnglish}
                onChange={() => setIsShowEnglish(!isShowEnglish)}
              />
              영어 보이기
            </label>
          ) : null}
          {imageUrl ? (
            <div style={{ maxWidth: "300px" }}>
              <img
                src={imageUrl}
                alt="image"
                style={{ width: "100%", height: "auto" }}
              />
            </div>
          ) : null}
          <MessageDisplay messages={messages} isShowEnglish={isShowEnglish} />
        </div>
      )}
    </div>
  );
}
