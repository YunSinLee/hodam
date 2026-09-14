import { supabase } from "./supabase";

export async function requireAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session)
    throw new Error("로그인이 만료됐어요. 다시 로그인해주세요.");
  return data.session.access_token;
}
