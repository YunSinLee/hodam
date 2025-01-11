"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import threadApi from "@/app/api/thread";
import messagesApi from "@/app/api/messages";
import imageApi from "@/app/api/image";
import type { Message, Thread } from "@/app/types/openai";
import MessageDisplay from "@/app/components/MessageDisplay";
import Link from "next/link";
import HButton from "@/app/components/atomic/HButton";

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
    const threadResult = await threadApi.getThreadByID(
      Number(params?.thread_id),
    );

    setThread(threadResult);
  }

  async function fetchMessages() {
    setIsLoading(true);
    const data = await messagesApi.fetchMessages({
      thread_ids: [Number(params?.thread_id)],
    });
    const targetMessage = data[Number(params?.thread_id)];
    if (targetMessage) {
      const texts = targetMessage.map((message: Message) => {
        return { text: message.message, text_en: message.message_en };
      });
      setMessages(texts);
    }
    setIsLoading(false);
  }

  async function fetchImage() {
    const imageUrlResult = await imageApi.getImage({
      thread_id: Number(params?.thread_id),
    });
    setImageUrl(imageUrlResult);
  }

  useEffect(() => {
    getThread();
    fetchMessages();
    fetchImage();
  }, []);

  return (
    <div className="px-4 sm:px-8 py-4">
      <div className="flex gap-4 items-center justify-between mb-8">
        <Link
          href={{
            pathname: `/my-story`,
          }}
        >
          <HButton
            className="font-medium"
            label="← 목록으로"
            size="sm"
            buttonStyle="outlined"
            color="neutral"
          />
        </Link>
        <p className="font-medium text-xl">이야기 {params?.thread_id}</p>
        {thread.able_english ? (
          <label
            htmlFor="showEnglish"
            className="cursor-pointer clickable-layer items-center flex gap-2 px-1"
          >
            <input
              id="showEnglish"
              type="checkbox"
              checked={isShowEnglish}
              onChange={() => setIsShowEnglish(!isShowEnglish)}
            />
            영어 보이기
          </label>
        ) : null}
      </div>
      {isLoading ? (
        <div>Loading...</div>
      ) : messages.length === 0 ? (
        <div>No messages</div>
      ) : (
        <div className="flex flex-col items-center">
          {imageUrl ? (
            <div className="max-w-80 sm:max-w-screen-sm">
              <img src={imageUrl} alt="" />
            </div>
          ) : null}
          <MessageDisplay messages={messages} isShowEnglish={isShowEnglish} />
        </div>
      )}
    </div>
  );
}
