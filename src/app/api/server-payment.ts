import "server-only";

import { createClient } from "@supabase/supabase-js";

export function paymentConfigured() {
  return Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
      process.env.TOSS_PAYMENTS_SECRET_KEY &&
      process.env.NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY,
  );
}
export function paymentAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Payment service unavailable");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
