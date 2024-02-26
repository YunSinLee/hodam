import { supabase } from "../utils/supabase";
import { Thread } from "../types/openai";

const threadApi = {
  async createThread({ thread_id }: { thread_id: string }): Promise<Thread> {
    const { data, error } = await supabase
      .from("thread")
      .insert({ openai_thread_id: thread_id })
      .select();

    if (error) {
      console.error("Error saving message", error);
    }

    return data![0] as Thread;
  },
};

export default threadApi;
