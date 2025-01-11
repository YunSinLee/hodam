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
    // Promise.all을 사용하여 모든 삽입 작업을 병렬로 수행
    const insertPromises = keywords.map(keyword =>
      supabase.from("keywords").insert({ keyword, thread_id }),
    );

    const results = await Promise.all(insertPromises);

    // 에러 처리
    results.forEach(({ error }) => {
      if (error) {
        console.error("Error saving keyword", error);
      }
    });

    const { data } = await supabase
      .from("keywords")
      .select()
      .eq("thread_id", thread_id);

    return data as Keyword[];
  },
  async fetchKeywords({
    thread_ids,
  }: {
    thread_ids: number[];
  }): Promise<Record<number, Keyword[]>> {
    const { data } = await supabase
      .from("keywords")
      .select()
      .in("thread_id", thread_ids);

    if (!data) return {};
    const groupedByThreadId: Record<number, Keyword[]> = data.reduce(
      (acc, keyword) => {
        if (!acc[keyword.thread_id]) {
          acc[keyword.thread_id] = [];
        }
        acc[keyword.thread_id].push(keyword);
        return acc;
      },
      {},
    );

    return groupedByThreadId;
  },
};

export default keywordsApi;
