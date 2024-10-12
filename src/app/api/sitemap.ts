const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const sitemapApi = {
  async fetchAllThreads() {
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
      .not("user_id", "is", null); // user_id가 NULL이 아닌 경우만 가져옴

    if (error) {
      console.error("Error fetching threads:", error);
      return [];
    }

    // // TODO: 추후 keywords가 없는 경우를 SQL로 처리하도록 변경
    // const filteredData = (data ?? []).filter(
    //   (thread: { keywords: { length: number } }) => thread.keywords && thread.keywords.length > 0,
    // );

    return data;
  },
};

module.exports = sitemapApi;

// 기본 내보내기 추가
module.exports.default = sitemapApi;
