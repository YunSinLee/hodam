import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createClientMock,
  getOptionalEnvMock,
  getPublicSupabaseEnvMock,
  getRequiredEnvMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  getOptionalEnvMock: vi.fn(),
  getPublicSupabaseEnvMock: vi.fn(),
  getRequiredEnvMock: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/env", () => ({
  getOptionalEnv: getOptionalEnvMock,
  getPublicSupabaseEnv: getPublicSupabaseEnvMock,
  getRequiredEnv: getRequiredEnvMock,
}));

async function loadModule() {
  return import("./server");
}

describe("supabase server clients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPublicSupabaseEnvMock.mockReturnValue({
      url: "https://public.supabase.co",
      anonKey: "anon-key",
      isConfigured: true,
    });
    getRequiredEnvMock.mockImplementation((name: string) => {
      if (name === "NEXT_PUBLIC_SUPABASE_URL") {
        return "https://admin.supabase.co";
      }
      throw new Error(`missing ${name}`);
    });
    createClientMock.mockReturnValue({} as never);
  });

  it("creates admin client with service role key when available", async () => {
    getOptionalEnvMock.mockImplementation((name: string) => {
      if (name === "SUPABASE_SERVICE_ROLE_KEY") return "service-role-key";
      if (name === "SUPABASE_URL") return "https://admin.supabase.co";
      return undefined;
    });

    const { createSupabaseAdminClient } = await loadModule();
    createSupabaseAdminClient();

    expect(createClientMock).toHaveBeenCalledWith(
      "https://admin.supabase.co",
      "service-role-key",
      expect.objectContaining({
        auth: expect.objectContaining({
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        }),
      }),
    );
  });

  it("falls back to user client when service role key is missing", async () => {
    getOptionalEnvMock.mockImplementation((name: string) => {
      if (name === "SUPABASE_SERVICE_ROLE_KEY") return undefined;
      if (name === "SUPABASE_URL") return "https://admin.supabase.co";
      if (name === "NODE_ENV") return "development";
      return undefined;
    });

    const { createSupabaseAdminClient } = await loadModule();
    createSupabaseAdminClient({ fallbackAccessToken: "token-1" });

    expect(createClientMock).toHaveBeenCalledWith(
      "https://public.supabase.co",
      "anon-key",
      expect.objectContaining({
        global: {
          headers: {
            Authorization: "Bearer token-1",
          },
        },
      }),
    );
  });

  it("throws when admin fallback is disabled without service role key", async () => {
    getOptionalEnvMock.mockImplementation((name: string) => {
      if (name === "SUPABASE_SERVICE_ROLE_KEY") return undefined;
      if (name === "HODAM_ALLOW_ADMIN_FALLBACK") return "false";
      if (name === "NODE_ENV") return "production";
      return undefined;
    });

    const { createSupabaseAdminClient } = await loadModule();

    expect(() =>
      createSupabaseAdminClient({ fallbackAccessToken: "token-1" }),
    ).toThrow(
      "SUPABASE_SERVICE_ROLE_KEY is required when HODAM_ALLOW_ADMIN_FALLBACK is disabled",
    );
  });

  it("throws when service role key is missing and no fallback token exists", async () => {
    getOptionalEnvMock.mockReturnValue(undefined);

    const { createSupabaseAdminClient } = await loadModule();

    expect(() => createSupabaseAdminClient()).toThrow(
      "Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY",
    );
  });
});
