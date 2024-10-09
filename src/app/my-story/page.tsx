"use client";

import threadApi from "@/app/api/thread";
import useUserInfo from "@/services/hooks/use-user-info";

import { useEffect, useState } from "react";
import type { ThreadWithUser } from "@/app/types/openai";
import Link from "next/link";
import { formatTime } from "@/app/utils";

export default function MyStory() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [threads, setThreads] = useState<ThreadWithUser[]>([]);
  const { userInfo } = useUserInfo();

  async function fetchAllThreads() {
    setIsLoading(true);
    const threads = await threadApi.fetchAllThreads();
    setThreads(threads);

    setIsLoading(false);
  }

  async function fetchThreadsByUserId() {
    if (!userInfo.id) return;
    setIsLoading(true);
    const threads = await threadApi.fetchThreadsByUserId({
      user_id: userInfo.id,
    });
    setThreads(threads);

    setIsLoading(false);
  }

  useEffect(() => {
    fetchAllThreads();
  }, []); // 빈 배열을 추가하여 컴포넌트가 마운트될 때만 호출되도록 변경

  useEffect(() => {
    fetchThreadsByUserId();
  }, [userInfo.id]); // userInfo.id가 변경될 때도 호출되도록 유지

  return (
    <div className="max-w-screen-sm sm:max-w-screen-lg mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">내 동화</h1>
      {isLoading ? (
        <div>이야기 목록을 불러오는 중...</div>
      ) : (
        <div>
          <div>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="min-w-12 sm:min-w-20 py-2 px-2 border-b text-center">
                    유저
                  </th>
                  <th className="min-w-12 sm:min-w-20 py-2 px-2 border-b text-center">
                    생성
                  </th>
                  <th className="py-2 px-2 border-b text-center">
                    동화 키워드
                  </th>
                  <th className="min-w-14 sm:min-w-20 py-2 px-2 border-b text-center">
                    영어
                  </th>
                  <th className="py-2 px-2 border-b text-center">이미지</th>
                  <th className="py-2 px-2 border-b text-center"></th>
                </tr>
              </thead>
              <tbody>
                {threads.map((thread: ThreadWithUser) => {
                  return (
                    <tr key={thread.id}>
                      <td className="min-w-12 sm:min-w-20 py-2 px-2 border-b text-center">
                        {thread.user?.display_name}
                      </td>
                      <td className="min-w-12 sm:min-w-20 py-2 px-2 border-b text-center">
                        <span className="hidden sm:block">
                          {formatTime(thread.created_at, "YY.MM.DD")}
                        </span>
                        <span className="block sm:hidden">
                          {formatTime(thread.created_at, "MM.DD")}
                        </span>
                      </td>
                      <td className="py-2 px-2 border-b text-center">
                        {thread.keywords
                          ?.map(keyword => keyword.keyword)
                          .join(", ")}
                      </td>
                      <td className="min-w-14 sm:min-w-20 py-2 px-2 border-b text-center">
                        {thread.able_english ? "가능" : "불가능"}
                      </td>
                      <td className="min-w-20 py-2 px-2 border-b text-center">
                        {thread.has_image ? "있어요" : "-"}
                      </td>
                      <td className="py-2 px-2 border-b text-gray-400 text-center">
                        <Link
                          href={{
                            pathname: `/my-story/${thread.id}`,
                            query: {
                              ableEnglish: thread.able_english,
                            },
                          }}
                        >
                          〉
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
