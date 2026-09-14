import { supabase } from "../utils/supabase";

import type { Message } from "../types/openai";

const messagesApi = {
  async fetchMessages({
    thread_ids,
  }: {
    thread_ids: number[];
  }): Promise<Record<number, Message[]>> {
    const { data, error } = await supabase
      .from("messages")
      .select()
      .in("thread_id", thread_ids);

    if (error) throw error;

    if (!data) return {};
    const groupedByThreadId: Record<number, Message[]> = data.reduce(
      (acc, message) => {
        if (!acc[message.thread_id]) {
          acc[message.thread_id] = [];
        }
        acc[message.thread_id].push(message);
        return acc;
      },
      {},
    );

    Object.values(groupedByThreadId).forEach(messages => {
      messages.sort((a, b) => a.id - b.id);
    });

    return groupedByThreadId;
  },
};
export default messagesApi;
