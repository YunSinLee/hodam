import { supabase } from "../utils/supabase";

const keywordsApi = {
  async saveKeywords({
    keywords,
    thread_id,
  }: {
    keywords: string[];
    thread_id: string;
  }) {
    keywords.forEach(async keyword => {
      const { data, error } = await supabase
        .from("keywords")
        .insert({ keyword, thread_id })
        .select();
      if (error) {
        console.error("Error saving keyword", error);
      }
      console.log("저장 성공", data);
    });
  },
};

export default keywordsApi;
