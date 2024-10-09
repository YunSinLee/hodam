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
    const { data, error } = await supabase.from("thread").select(
      `
        *,
        user: user_id (
          id,
          email,
          display_name
        )
      `,
    );

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
    const { data } = await supabase
      .from("thread")
      .select(
        `
          *,
          user: user_id (
            id,
            email,
            display_name
          )
        `,
      )
      .eq("user_id", user_id);

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
