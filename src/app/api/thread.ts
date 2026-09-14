import v1ThreadApi from "@/lib/client/api/thread";

import { supabase } from "../utils/supabase";

import type { Thread, ThreadWithUser } from "../types/openai";

function requireThread(data: Thread[] | null, context: string) {
  if (!data || data.length === 0) {
    throw new Error(`${context}: thread 데이터를 불러오지 못했습니다.`);
  }

  return data[0] as Thread;
}

const threadApi = {
  ...v1ThreadApi,
  async getThreadByID(thread_id: number): Promise<Thread> {
    const { data, error } = await supabase
      .from("thread")
      .select("*")
      .eq("id", thread_id);

    if (error) {
      throw error;
    }

    return requireThread(data as Thread[] | null, "getThreadByID");
  },
  async fetchThreadsByUserId({
    user_id,
  }: {
    user_id?: string;
  } = {}): Promise<ThreadWithUser[]> {
    if (!user_id) return v1ThreadApi.fetchThreadsByUserId();
    const { data, error } = await supabase
      .from("thread")
      .select(
        `
          *,
          user: user_id (
            id,
            email,
            display_name
          ),
          keywords:keywords (
            id,
            thread_id,
            keyword
          ),
          messages:messages (
            id,
            thread_id
          )
        `,
      )
      .eq("user_id", user_id)
      .order("created_at", { ascending: false }); // 최신순 정렬

    if (error) {
      throw error;
    }

    // 키워드가 있거나 메시지가 있는 thread만 필터링
    const filteredData = (data as ThreadWithUser[]).filter(thread => {
      const hasKeywords = thread.keywords && thread.keywords.length > 0;
      const hasMessages = thread.messages && thread.messages.length > 0;
      return !!thread.raw_text || hasKeywords || hasMessages;
    });

    return filteredData as ThreadWithUser[];
  },
};

export default threadApi;
export * from "@/lib/client/api/thread";
