"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import messagesApi from "@/app/api/messages";
import { Message } from "@/app/types/openai";
import MessageDisplay from "@/app/components/MessageDisplay";

export default function MyStoryDetail() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [messages, setMessages] = useState<{ text: string }[]>([]);
  const params = useParams();
  async function fetchMessages() {
    setIsLoading(true);
    const data = await messagesApi.fetchMessages({
      thread_ids: [Number(params.thread_id)],
    });
    console.log("data", data);
    const targetMessage = data[Number(params.thread_id)];
    if (targetMessage) {
      const texts = targetMessage.map((message: Message) => {
        return { text: message.message };
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
        <MessageDisplay messages={messages} />
      )}
    </div>
  );
}
