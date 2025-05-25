import { supabase } from "../utils/supabase";

import type { Thread, ThreadWithUser } from "../types/openai";

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
      .not("user_id", "is", null) // user_id가 NULL이 아닌 경우만 가져옴
      .order("created_at", { ascending: false }); // 최신순 정렬

    if (error) {
      console.error("Error fetching threads:", error);
      return [];
    }

    return data as ThreadWithUser[];
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
          )
        `,
      )
      .eq("user_id", user_id)
      .order("created_at", { ascending: false }); // 최신순 정렬

    if (error) {
      console.error("Error fetching threads:", error);
      return [];
    }

    return data as ThreadWithUser[];
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
