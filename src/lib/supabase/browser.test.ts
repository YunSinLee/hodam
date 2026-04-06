import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock, getPublicSupabaseEnvMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  getPublicSupabaseEnvMock: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/env", () => ({
  getPublicSupabaseEnv: getPublicSupabaseEnvMock,
}));

async function loadModule() {
  return import("./browser");
}

describe("supabase browser client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    getPublicSupabaseEnvMock.mockReturnValue({
      url: "https://public.supabase.co",
      anonKey: "anon-key",
      isConfigured: true,
    });
    createClientMock.mockReturnValue({ auth: {} } as never);
  });

  it("creates browser client with explicit auth options", async () => {
    const { getBrowserSupabaseClient } = await loadModule();
    getBrowserSupabaseClient();

    expect(createClientMock).toHaveBeenCalledWith(
      "https://public.supabase.co",
      "anon-key",
      expect.objectContaining({
        auth: expect.objectContaining({
          flowType: "pkce",
          detectSessionInUrl: false,
          persistSession: true,
          autoRefreshToken: true,
        }),
      }),
    );
  });

  it("returns singleton instance on repeated access", async () => {
    const created = { auth: { marker: "client-1" } } as never;
    createClientMock.mockReturnValue(created);

    const { getBrowserSupabaseClient } = await loadModule();
    const first = getBrowserSupabaseClient();
    const second = getBrowserSupabaseClient();

    expect(first).toBe(second);
    expect(createClientMock).toHaveBeenCalledTimes(1);
  });
});
