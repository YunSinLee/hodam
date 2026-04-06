const REQUIRED_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

const DUMMY_SUPABASE_URL = "https://placeholder.supabase.co";
const DUMMY_SUPABASE_KEY = "placeholder-anon-key";

const PUBLIC_ENV_MAP: Record<string, string | undefined> = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_AUTH_REDIRECT_URL: process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL,
  NEXT_PUBLIC_GA_ID: process.env.NEXT_PUBLIC_GA_ID,
};

function fromEnv(name: string): string | undefined {
  const value = PUBLIC_ENV_MAP[name] ?? process.env[name];
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function getRequiredEnv(name: string): string {
  const value = fromEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getOptionalEnv(name: string): string | undefined {
  return fromEnv(name);
}

export function getPublicSupabaseEnv() {
  const url = getOptionalEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = getOptionalEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (!url || !anonKey) {
    // Build-time fallback to avoid hard crash during static analysis.
    return {
      url: DUMMY_SUPABASE_URL,
      anonKey: DUMMY_SUPABASE_KEY,
      isConfigured: false,
    };
  }

  return {
    url,
    anonKey,
    isConfigured: true,
  };
}

export function assertPublicSupabaseConfigured() {
  REQUIRED_VARS.forEach(key => {
    const value = getOptionalEnv(key);
    if (!value) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  });
}
