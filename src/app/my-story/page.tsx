"use client";

import threadApi from "@/app/api/thread";
import keywordsApi from "@/app/api/keywords";
import useUserInfo from "@/services/hooks/use-user-info";

import { useEffect, useState } from "react";
import type { Keyword, Thread } from "../types/openai";
import Link from "next/link";

export default function MyStory() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [keywordsByThread, setKeywordsByThread] = useState<
    Record<number, Keyword[]>
  >([]);
  const { userInfo } = useUserInfo();

  async function fetchThreadsByUserId() {
    if (!userInfo.id) return;
    setIsLoading(true);
    const threads = await threadApi.fetchThreadsByUserId({
      user_id: userInfo.id,
    });
    setThreads(threads);
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
    fetchThreadsByUserId();
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
                  <th className="py-2 px-4 border-b text-center">번호</th>
                  <th className="py-2 px-4 border-b text-center">
                    동화 키워드
                  </th>
                  <th className="py-2 px-4 border-b text-center">영어보기</th>
                  <th className="py-2 px-4 border-b text-center">상세보기</th>
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
                      <td className="py-2 px-4 border-b text-center">
                        {threads.find(
                          thread => thread.id === parseInt(threadId),
                        )?.able_english
                          ? "가능"
                          : "불가능"}
                      </td>
                      <td className="py-2 px-4 border-b text-blue-500 text-center">
                        <Link
                          href={{
                            pathname: `/my-story/${threadId}`,
                            query: {
                              ableEnglish: threads.find(
                                thread => thread.id === parseInt(threadId),
                              )?.able_english,
                            },
                          }}
                        >
                          클릭
                        </Link>
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
