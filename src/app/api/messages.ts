import { supabase } from "../utils/supabase";

const messagesApi = {
  async saveMessages({
    messages,
    thread_id,
    keywords,
  }: {
    messages: string[];
    thread_id: string;
    keywords: string[];
  }) {
    messages.forEach(async message => {
      console.log("message", message);
      const { data, error } = await supabase
        .from("messages")
        .insert({ message, thread_id, keywords })
        .select();
      if (error) {
        console.error("Error saving message", error);
      }
      console.log("저장 성공", data);
    });
  },
};

export default messagesApi;
