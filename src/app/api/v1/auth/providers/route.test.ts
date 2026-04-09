import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvidersResponseSchema } from "@/app/api/v1/schemas";

const { checkRateLimitMock, logErrorMock } = vi.hoisted(() => ({
  checkRateLimitMock: vi.fn(),
  logErrorMock: vi.fn(),
}));

vi.mock("@/lib/server/rate-limit", () => ({
  checkRateLimit: checkRateLimitMock,
}));

vi.mock("@/lib/server/logger", () => ({
  logError: logErrorMock,
}));

async function loadGetHandler() {
  const routeModule = await import("./route");
  return routeModule.GET;
}

function createRequest(url = "http://localhost:3000/api/v1/auth/providers") {
  return {
    headers: new Headers({
      "x-forwarded-for": "127.0.0.1",
    }),
    nextUrl: new URL(url),
  } as never;
}

function setSupabasePublicEnv() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
}

function expectAuthProvidersContract(body: unknown) {
  const parsed = AuthProvidersResponseSchema.safeParse(body);
  expect(parsed.success).toBe(true);
}

describe("GET /api/v1/auth/providers", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    checkRateLimitMock.mockReturnValue(true);
    setSupabasePublicEnv();
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL;
  });

  it("returns 429 when rate limit is exceeded", async () => {
    checkRateLimitMock.mockReturnValue(false);
    const GET = await loadGetHandler();

    const response = await GET(createRequest());
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toEqual({
      error: "Too many auth provider diagnostics requests",
      code: "AUTH_PROVIDERS_RATE_LIMITED",
    });
  });

  it("returns degraded diagnostics payload when Supabase public env is missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const GET = await loadGetHandler();

    const response = await GET(createRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expectAuthProvidersContract(body);
    expect(body.settingsReachable).toBe(false);
    expect(body.settingsStatus).toBeNull();
    expect(body.allEnabled).toBe(false);
    expect(body.providers.google).toEqual({
      enabled: null,
      reason: "auth_settings_public_env_missing",
    });
    expect(body.providers.kakao).toEqual({
      enabled: null,
      reason: "auth_settings_public_env_missing",
    });
    expect(body.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("NEXT_PUBLIC_SUPABASE_URL"),
      ]),
    );
  });

  it("returns enabled statuses when providers are configured", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(
        JSON.stringify({
          external: {
            google: true,
            kakao: true,
          },
        }),
      ),
    });
    const GET = await loadGetHandler();

    const response = await GET(createRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expectAuthProvidersContract(body);
    expect(body.settingsReachable).toBe(true);
    expect(body.allEnabled).toBe(true);
    expect(body.providers).toEqual({
      google: {
        enabled: true,
      },
      kakao: {
        enabled: true,
      },
    });
  });

  it("returns disabled status for missing or disabled provider config", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(
        JSON.stringify({
          external: {
            google: true,
            kakao: false,
          },
        }),
      ),
    });
    const GET = await loadGetHandler();

    const response = await GET(createRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expectAuthProvidersContract(body);
    expect(body.allEnabled).toBe(false);
    expect(body.providers.google).toEqual({
      enabled: true,
    });
    expect(body.providers.kakao).toEqual({
      enabled: false,
      reason: "disabled_in_supabase_auth_settings",
    });
  });

  it("returns health warning state when auth settings request fails with HTTP", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue("internal error"),
    });
    const GET = await loadGetHandler();

    const response = await GET(createRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expectAuthProvidersContract(body);
    expect(body.settingsReachable).toBe(false);
    expect(body.settingsStatus).toBe(500);
    expect(body.providers.google).toEqual({
      enabled: null,
      reason: "auth_settings_http_error",
    });
    expect(body.providers.kakao).toEqual({
      enabled: null,
      reason: "auth_settings_http_error",
    });
  });

  it("returns health warning state when auth settings request throws", async () => {
    fetchMock.mockRejectedValue(new Error("network failed"));
    const GET = await loadGetHandler();

    const response = await GET(createRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expectAuthProvidersContract(body);
    expect(body.settingsReachable).toBe(false);
    expect(body.settingsStatus).toBeNull();
    expect(body.providers.google).toEqual({
      enabled: null,
      reason: "auth_settings_fetch_failed",
    });
    expect(body.providers.kakao).toEqual({
      enabled: null,
      reason: "auth_settings_fetch_failed",
    });
    expect(logErrorMock).toHaveBeenCalledWith(
      "/api/v1/auth/providers settings fetch failed",
      expect.any(Error),
      expect.objectContaining({
        runtimeOrigin: "http://localhost:3000",
      }),
    );
  });
});
