"use client";

import threadApi from "@/app/api/thread";
import keywordsApi from "@/app/api/keywords";
import useUserInfo from "@/services/hooks/use-user-info";

import { useEffect, useState } from "react";
import type { Keyword, Message } from "../types/openai";
import Link from "next/link";

export default function MyStory() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  //   const [story, setStory] = useState<
  //     Record<
  //       number,
  //       {
  //         keywords: Keyword[];
  //         messages: Message[];
  //       }
  //     >
  //   >({});
  const [keywordsByThread, setKeywordsByThread] = useState<
    Record<number, Keyword[]>
  >([]);
  const { userInfo } = useUserInfo();

  //   async function fetchThreads() {
  //     if (!userInfo.id) return;
  //     setIsLoading(true);
  //     const threads = await threadApi.fetchThreads({ user_id: userInfo.id });

  //     const [keywords, messages] = await Promise.all([
  //       keywordsApi.fetchKeywords({
  //         thread_ids: threads.map(thread => thread.id),
  //       }),
  //       messagesApi.fetchMessages({
  //         thread_ids: threads.map(thread => thread.id),
  //       }),
  //     ]);

  //     const storyByThread: Record<
  //       number,
  //       {
  //         keywords: Keyword[];
  //         messages: Message[];
  //       }
  //     > = {};
  //     for (const thread of threads) {
  //       if (!keywords[thread.id] || !messages[thread.id]) continue;
  //       storyByThread[thread.id] = {
  //         keywords: keywords[thread.id],
  //         messages: messages[thread.id],
  //       };
  //     }

  //     setStory(storyByThread);
  //     setIsLoading(false);
  //   }

  async function fetchThreads() {
    if (!userInfo.id) return;
    setIsLoading(true);
    const threads = await threadApi.fetchThreads({ user_id: userInfo.id });

    const keywords = await keywordsApi.fetchKeywords({
      thread_ids: threads.map(thread => thread.id),
    });

    const result: Record<number, Keyword[]> = {};
    for (const thread of threads) {
      if (!keywords[thread.id]) continue;
      result[thread.id] = keywords[thread.id];
    }

    setKeywordsByThread(result);
    setIsLoading(false);
  }

  useEffect(() => {
    fetchThreads();
  }, [userInfo.id]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">My Story</h1>
      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <div>
          <div>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="py-2 px-4 border-b text-center">Thread ID</th>
                  <th className="py-2 px-4 border-b text-center">Keywords</th>
                  <th className="py-2 px-4 border-b text-center">Details</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(keywordsByThread).map(threadId => {
                  const keywords = keywordsByThread[parseInt(threadId)];
                  return (
                    <tr key={threadId}>
                      <td className="py-2 px-4 border-b text-center">
                        {threadId}
                      </td>
                      <td className="py-2 px-4 border-b text-center">
                        {keywords.map(keyword => (
                          <a key={keyword.id} className="mr-2">
                            {keyword.keyword}
                          </a>
                        ))}
                      </td>
                      <td className="py-2 px-4 border-b text-blue-500 text-center">
                        <Link href={`/my-story/${threadId}`}>자세히보기</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
