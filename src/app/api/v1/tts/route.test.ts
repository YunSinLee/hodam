import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getAudioWithCacheMock,
  getAudioArrayWithCacheMock,
  authenticateRequestMock,
  consumeDailyTtsQuotaMock,
  checkRateLimitMock,
  createAdminMock,
} = vi.hoisted(() => ({
  getAudioWithCacheMock: vi.fn(),
  getAudioArrayWithCacheMock: vi.fn(),
  authenticateRequestMock: vi.fn(),
  consumeDailyTtsQuotaMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  createAdminMock: vi.fn(),
}));

class DailyQuotaExceededErrorMock extends Error {
  readonly code:
    | "DAILY_AI_COST_LIMIT_EXCEEDED"
    | "DAILY_TTS_CHAR_LIMIT_EXCEEDED";

  constructor(
    code: "DAILY_AI_COST_LIMIT_EXCEEDED" | "DAILY_TTS_CHAR_LIMIT_EXCEEDED",
  ) {
    super(code);
    this.name = "DailyQuotaExceededError";
    this.code = code;
  }
}

vi.mock("@/lib/client/api/google-tts", () => ({
  default: {
    getAudioWithCache: getAudioWithCacheMock,
    getAudioArrayWithCache: getAudioArrayWithCacheMock,
  },
}));

vi.mock("@/lib/auth/request-auth", () => ({
  authenticateRequest: authenticateRequestMock,
}));

vi.mock("@/lib/server/quota", () => ({
  consumeDailyTtsQuota: consumeDailyTtsQuotaMock,
  DailyQuotaExceededError: DailyQuotaExceededErrorMock,
}));

vi.mock("@/lib/server/rate-limit", () => ({
  checkRateLimit: checkRateLimitMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: createAdminMock,
}));

async function loadPostHandler() {
  const routeModule = await import("./route");
  return routeModule.POST;
}

describe("POST /api/v1/tts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkRateLimitMock.mockReturnValue(true);
    createAdminMock.mockReturnValue({ rpc: vi.fn() });
    consumeDailyTtsQuotaMock.mockResolvedValue({ used: 10, remaining: 90 });
    getAudioWithCacheMock.mockResolvedValue("audio-short");
    getAudioArrayWithCacheMock.mockResolvedValue(["audio-1", "audio-2"]);
  });

  it("returns 401 when unauthorized", async () => {
    authenticateRequestMock.mockResolvedValue(null);
    const POST = await loadPostHandler();

    const response = await POST({ headers: new Headers() } as never);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get("x-request-id")).toMatch(
      /[A-Za-z0-9._:-]{1,128}/,
    );
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("returns 429 when rate limit is exceeded", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    checkRateLimitMock.mockReturnValue(false);

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({ text: "안녕하세요" }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toEqual({ error: "Too many TTS requests" });
  });

  it("returns 400 when pitch is outside range", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({ text: "안녕하세요", pitch: 4 }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Pitch must be between 0.5 and 2.0" });
  });

  it("returns 400 when language code is invalid", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers(),
      json: vi
        .fn()
        .mockResolvedValue({ text: "안녕하세요", language: "korean" }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Invalid language code" });
  });

  it("returns audio data for short text", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({ text: "안녕하세요", language: "ko" }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getAudioWithCacheMock).toHaveBeenCalledWith("안녕하세요", "ko", 1);
    expect(getAudioArrayWithCacheMock).not.toHaveBeenCalled();
    expect(body).toEqual({
      audioDataArray: ["audio-short"],
      contentType: "audio/mp3",
    });
  });

  it("returns audio array for long text", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });

    const longText = "가".repeat(191);
    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers(),
      json: vi
        .fn()
        .mockResolvedValue({ text: longText, language: "ko", pitch: 1.2 }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getAudioArrayWithCacheMock).toHaveBeenCalledWith(
      longText,
      "ko",
      1.2,
    );
    expect(getAudioWithCacheMock).not.toHaveBeenCalled();
    expect(body.audioDataArray).toEqual(["audio-1", "audio-2"]);
  });

  it("returns 429 when daily tts quota is exceeded", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    consumeDailyTtsQuotaMock.mockRejectedValue(
      new DailyQuotaExceededErrorMock("DAILY_TTS_CHAR_LIMIT_EXCEEDED"),
    );

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({ text: "안녕하세요" }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toEqual({ error: "Daily TTS character quota exceeded" });
  });
});
