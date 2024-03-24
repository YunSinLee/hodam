import { supabase } from "../utils/supabase";
import { Message } from "../types/openai";

const messagesApi = {
  async saveMessages({
    messages,
    thread_id,
    turn,
  }: {
    messages: string[];
    thread_id: number;
    turn: number;
  }): Promise<Message[]> {
    for (const message of messages) {
      const { error } = await supabase
        .from("messages")
        .insert({ message, thread_id, turn })
        .select();

      if (error) {
        console.error("Error saving message", error);
      }
    }

    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("thread_id", thread_id)
      .eq("turn", turn);

    return data as Message[];
  },
};

export default messagesApi;
