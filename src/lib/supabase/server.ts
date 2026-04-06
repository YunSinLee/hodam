import { SupabaseClient, createClient } from "@supabase/supabase-js";

import {
  getOptionalEnv,
  getPublicSupabaseEnv,
  getRequiredEnv,
} from "@/lib/env";

function parseBooleanLike(value: string | undefined): boolean | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return null;
}

function canUseAdminFallbackClient(): boolean {
  const explicit = parseBooleanLike(
    getOptionalEnv("HODAM_ALLOW_ADMIN_FALLBACK"),
  );
  if (explicit !== null) {
    return explicit;
  }

  return getOptionalEnv("NODE_ENV") !== "production";
}

export function createSupabaseAnonServerClient(): SupabaseClient {
  const { url, anonKey } = getPublicSupabaseEnv();
  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export function createSupabaseUserServerClient(
  accessToken: string,
): SupabaseClient {
  const { url, anonKey } = getPublicSupabaseEnv();
  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

interface AdminClientOptions {
  fallbackAccessToken?: string;
}

export function createSupabaseAdminClient(
  options: AdminClientOptions = {},
): SupabaseClient {
  const serviceRoleKey = getOptionalEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey) {
    const canUseFallback = canUseAdminFallbackClient();
    if (options.fallbackAccessToken && canUseFallback) {
      return createSupabaseUserServerClient(options.fallbackAccessToken);
    }
    if (options.fallbackAccessToken && !canUseFallback) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY is required when HODAM_ALLOW_ADMIN_FALLBACK is disabled",
      );
    }
    throw new Error(
      "Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  const url =
    getOptionalEnv("SUPABASE_URL") ||
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
