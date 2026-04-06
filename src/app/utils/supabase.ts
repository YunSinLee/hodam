import { getBrowserSupabaseClient } from "@/lib/supabase/browser";

import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!client) {
    client = getBrowserSupabaseClient();
  }
  return client;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const current = getClient() as unknown as Record<string, unknown>;
    const value = Reflect.get(current, prop, receiver);
    if (typeof value === "function") {
      return value.bind(current);
    }
    return value;
  },
}) as SupabaseClient;
