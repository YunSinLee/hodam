import "server-only";

import { createClient } from "@supabase/supabase-js";

export async function requireServerUser(accessToken: string | undefined) {
  if (
    !accessToken ||
    typeof accessToken !== "string" ||
    accessToken.length > 8192 ||
    /\s/.test(accessToken)
  )
    throw new Error("로그인이 필요합니다.");
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    },
  );
  const { data, error } = await client.auth.getUser(accessToken).catch(() => {
    throw new Error("로그인을 확인하지 못했어요. 잠시 후 다시 시도해주세요.");
  });
  if (error || !data.user)
    throw new Error("로그인이 만료됐어요. 다시 로그인해주세요.");
  return { user: data.user, client };
}
