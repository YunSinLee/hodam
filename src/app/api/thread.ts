import { supabase } from "../utils/supabase";

import type { Thread, ThreadWithUser } from "../types/openai";

function requireThread(data: Thread[] | null, context: string) {
  if (!data || data.length === 0) {
    throw new Error(`${context}: thread 데이터를 불러오지 못했습니다.`);
  }

  return data[0] as Thread;
}

const threadApi = {
  async createThread({
    thread_id,
    user_id,
    able_english,
    has_image,
  }: {
    thread_id: string;
    user_id: string | undefined;
    able_english?: boolean;
    has_image?: boolean;
  }): Promise<Thread> {
    const { data, error } = await supabase
      .from("thread")
      .insert({
        openai_thread_id: thread_id,
        user_id: user_id || null,
        able_english: able_english || false,
        has_image: has_image || false,
      })
      .select();

    if (error) {
      console.error("Error saving message", error);
      throw error;
    }

    return requireThread(data as Thread[] | null, "createThread");
  },
  async getThreadByID(thread_id: number): Promise<Thread> {
    const { data, error } = await supabase
      .from("thread")
      .select("*")
      .eq("id", thread_id);

    if (error) {
      console.error("Error getting thread", error);
      throw error;
    }

    return requireThread(data as Thread[] | null, "getThreadByID");
  },
  async fetchAllThreads(): Promise<ThreadWithUser[]> {
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
      .not("user_id", "is", null) // user_id가 NULL이 아닌 경우만 가져옴
      .order("created_at", { ascending: false }); // 최신순 정렬

    if (error) {
      console.error("Error fetching threads:", error);
      throw error;
    }

    // 키워드가 있거나 메시지가 있는 thread만 필터링
    const filteredData = data.filter((thread: any) => {
      const hasKeywords = thread.keywords && thread.keywords.length > 0;
      const hasMessages = thread.messages && thread.messages.length > 0;
      return !!thread.raw_text || hasKeywords || hasMessages;
    });

    return filteredData as ThreadWithUser[];
  },
  async fetchThreadsByUserId({
    user_id,
  }: {
    user_id: string;
  }): Promise<ThreadWithUser[]> {
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
      console.error("Error fetching threads:", error);
      throw error;
    }

    // 키워드가 있거나 메시지가 있는 thread만 필터링
    const filteredData = data.filter((thread: any) => {
      const hasKeywords = thread.keywords && thread.keywords.length > 0;
      const hasMessages = thread.messages && thread.messages.length > 0;
      return !!thread.raw_text || hasKeywords || hasMessages;
    });

    return filteredData as ThreadWithUser[];
  },
  async updateThread({
    thread_id,
    user_id,
    able_english,
    has_image,
    raw_text,
  }: {
    thread_id: number;
    user_id: string | undefined;
    able_english?: boolean;
    has_image?: boolean;
    raw_text?: string;
  }) {
    const updateData: {
      able_english?: boolean;
      has_image?: boolean;
      raw_text?: string;
    } = {};
    if (able_english !== undefined) updateData.able_english = able_english;
    if (has_image !== undefined) updateData.has_image = has_image;
    if (raw_text !== undefined) updateData.raw_text = raw_text;

    const { data, error } = await supabase
      .from("thread")
      .update(updateData)
      .eq("id", thread_id)
      .eq("user_id", user_id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  },
};

export default threadApi;
