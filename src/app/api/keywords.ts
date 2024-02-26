import { supabase } from "../utils/supabase";
import { Keyword } from "../types/openai";

const keywordsApi = {
  async saveKeywords({
    keywords,
    thread_id,
  }: {
    keywords: string[];
    thread_id: number;
  }): Promise<Keyword[]> {
    for (const keyword of keywords) {
      const { error } = await supabase
        .from("keywords")
        .insert({ keyword, thread_id });

      if (error) {
        console.error("Error saving keyword", error);
      }
    }

    const { data } = await supabase
      .from("keywords")
      .select()
      .eq("thread_id", thread_id);

    return data as Keyword[];
  },
};

export default keywordsApi;
