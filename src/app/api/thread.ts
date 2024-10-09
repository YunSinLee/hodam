import { supabase } from "../utils/supabase";
import type { Thread, ThreadWithUser } from "../types/openai";

const threadApi = {
  async createThread({
    thread_id,
    user_id,
  }: {
    thread_id: string;
    user_id: string | undefined;
  }): Promise<Thread> {
    const { data, error } = await supabase
      .from("thread")
      .insert({
        openai_thread_id: thread_id,
        user_id: user_id ? user_id : null,
      })
      .select();

    if (error) {
      console.error("Error saving message", error);
    }

    return data![0] as Thread;
  },
  async getThreadByID(thread_id: number): Promise<Thread> {
    const { data } = await supabase
      .from("thread")
      .select("*")
      .eq("id", thread_id);

    return data![0] as Thread;
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
        )
      `,
      )
      .not("user_id", "is", null); // user_id가 NULL이 아닌 경우만 가져옴

    if (error) {
      console.error("Error fetching threads:", error);
      return [];
    }

    // TODO: 추후 keywords가 없는 경우를 SQL로 처리하도록 변경
    const filteredData = (data ?? []).filter(
      thread => thread.keywords && thread.keywords.length > 0,
    );

    return filteredData as ThreadWithUser[];
  },
  async fetchThreadsByUserId({
    user_id,
  }: {
    user_id: string;
  }): Promise<ThreadWithUser[]> {
    const { data } = await supabase
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
          )
        `,
      )
      .eq("user_id", user_id);

    // TODO: 추후 keywords가 없는 경우를 SQL로 처리하도록 변경
    const filteredData = (data ?? []).filter(
      thread => thread.keywords && thread.keywords.length > 0,
    );

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
    const { data, error } = await supabase
      .from("thread")
      .update({
        able_english,
        has_image,
        raw_text,
      })
      .eq("id", thread_id)
      .eq("user_id", user_id);

    if (error) {
      console.error("Error updating thread", error);
    }

    return data;
  },
};

export default threadApi;
