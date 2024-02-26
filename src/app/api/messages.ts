import { supabase } from "../utils/supabase";
import { Message } from "../types/openai";

const messagesApi = {
  async saveMessages({
    messages,
    thread_id,
    order,
  }: {
    messages: string[];
    thread_id: number;
    order: number;
  }): Promise<Message[]> {
    for (const message of messages) {
      const { error } = await supabase
        .from("messages")
        .insert({ message, thread_id, order });

      if (error) {
        console.error("Error saving message", error);
      }
    }

    const { data } = await supabase
      .from("messages")
      .select()
      .eq("thread_id", thread_id)
      .eq("order", order);

    return data as Message[];
  },
};

export default messagesApi;
