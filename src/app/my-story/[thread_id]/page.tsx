"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import messagesApi from "@/app/api/messages";
import { Message } from "@/app/types/openai";
import imageApi from "@/app/api/image";
import MessageDisplay from "@/app/components/MessageDisplay";

export default function MyStoryDetail() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [messages, setMessages] = useState<{ text: string; text_en: string }[]>(
    [],
  );
  const [isShowEnglish, setIsShowEnglish] = useState<boolean>(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const params = useParams();
  async function fetchMessages() {
    setIsLoading(true);
    const data = await messagesApi.fetchMessages({
      thread_ids: [Number(params.thread_id)],
    });
    const url = await imageApi.getImage({
      thread_id: Number(params.thread_id),
    });
    console.log("publicUrl", url);
    setImageUrl(url);
    console.log("data", data);
    const targetMessage = data[Number(params.thread_id)];
    if (targetMessage) {
      const texts = targetMessage.map((message: Message) => {
        return { text: message.message, text_en: message.message_en };
      });
      console.log("texts", texts);
      setMessages(texts);
    }
    setIsLoading(false);
    console.log(messages.length);
  }

  useEffect(() => {
    fetchMessages();
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
          <label>
            <input
              type="checkbox"
              checked={isShowEnglish}
              onChange={() => setIsShowEnglish(!isShowEnglish)}
            />
            영어 보이기
          </label>
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
