import { afterEach, describe, expect, it, vi } from "vitest";

function setEnv(name: string, value?: string) {
  if (typeof value === "string") {
    process.env[name] = value;
  } else {
    delete process.env[name];
  }
}

describe("getPublicSupabaseEnv", () => {
  const original = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };

  afterEach(() => {
    setEnv("NEXT_PUBLIC_SUPABASE_URL", original.url);
    setEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", original.anon);
    vi.resetModules();
  });

  it("returns configured env values when NEXT_PUBLIC vars exist", async () => {
    setEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    setEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key-value");
    vi.resetModules();

    const { getPublicSupabaseEnv } = await import("@/lib/env");
    const result = getPublicSupabaseEnv();

    expect(result).toEqual({
      url: "https://example.supabase.co",
      anonKey: "anon-key-value",
      isConfigured: true,
    });
  });

  it("falls back to placeholder when public env is missing", async () => {
    setEnv("NEXT_PUBLIC_SUPABASE_URL");
    setEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    vi.resetModules();

    const { getPublicSupabaseEnv } = await import("@/lib/env");
    const result = getPublicSupabaseEnv();

    expect(result.isConfigured).toBe(false);
    expect(result.url).toContain("placeholder.supabase.co");
    expect(result.anonKey).toContain("placeholder");
  });
});
