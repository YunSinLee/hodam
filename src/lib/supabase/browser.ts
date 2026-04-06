"use client";

import { SupabaseClient, createClient } from "@supabase/supabase-js";

import { getPublicSupabaseEnv } from "@/lib/env";

let browserClient: SupabaseClient | null = null;

export function getBrowserSupabaseClient(): SupabaseClient {
  if (browserClient) return browserClient;

  const { url, anonKey } = getPublicSupabaseEnv();
  browserClient = createClient(url, anonKey, {
    auth: {
      flowType: "pkce",
      detectSessionInUrl: false,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  return browserClient;
}
