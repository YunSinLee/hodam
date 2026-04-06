import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  generateStoryTurnMock,
  generateStoryImageBase64Mock,
  authenticateRequestMock,
  trackUserActivityBestEffortMock,
  appendThreadRawTextMock,
  creditBeadsMock,
  createStoryThreadMock,
  debitBeadsMock,
  saveKeywordsMock,
  saveStoryTurnMock,
  uploadThreadImageMock,
  consumeDailyAiQuotaMock,
  checkRateLimitMock,
  createAdminMock,
  detectBlockedTopicMock,
} = vi.hoisted(() => ({
  generateStoryTurnMock: vi.fn(),
  generateStoryImageBase64Mock: vi.fn(),
  authenticateRequestMock: vi.fn(),
  trackUserActivityBestEffortMock: vi.fn(),
  appendThreadRawTextMock: vi.fn(),
  creditBeadsMock: vi.fn(),
  createStoryThreadMock: vi.fn(),
  debitBeadsMock: vi.fn(),
  saveKeywordsMock: vi.fn(),
  saveStoryTurnMock: vi.fn(),
  uploadThreadImageMock: vi.fn(),
  consumeDailyAiQuotaMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  createAdminMock: vi.fn(),
  detectBlockedTopicMock: vi.fn(),
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

function AiServiceConfigurationErrorMock(
  message = "OPENAI_API_KEY is not configured",
) {
  const error = new Error(message);
  error.name = "AiServiceConfigurationError";
  Object.setPrototypeOf(error, AiServiceConfigurationErrorMock.prototype);
  return error;
}

AiServiceConfigurationErrorMock.prototype = Object.create(Error.prototype);
AiServiceConfigurationErrorMock.prototype.constructor =
  AiServiceConfigurationErrorMock;

vi.mock("@/lib/ai/story-service", () => ({
  AiServiceConfigurationError: AiServiceConfigurationErrorMock,
  generateStoryTurn: generateStoryTurnMock,
  generateStoryImageBase64: generateStoryImageBase64Mock,
}));

vi.mock("@/lib/auth/request-auth", () => ({
  authenticateRequest: authenticateRequestMock,
}));

vi.mock("@/lib/server/analytics", () => ({
  trackUserActivityBestEffort: trackUserActivityBestEffortMock,
}));

vi.mock("@/lib/server/hodam-repo", () => ({
  appendThreadRawText: appendThreadRawTextMock,
  creditBeads: creditBeadsMock,
  createStoryThread: createStoryThreadMock,
  debitBeads: debitBeadsMock,
  saveKeywords: saveKeywordsMock,
  saveStoryTurn: saveStoryTurnMock,
  uploadThreadImage: uploadThreadImageMock,
}));

vi.mock("@/lib/server/quota", () => ({
  DailyQuotaExceededError: DailyQuotaExceededErrorMock,
  consumeDailyAiQuota: consumeDailyAiQuotaMock,
}));

vi.mock("@/lib/server/rate-limit", () => ({
  checkRateLimit: checkRateLimitMock,
}));

vi.mock("@/lib/safety/content-policy", () => ({
  detectBlockedTopic: detectBlockedTopicMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: createAdminMock,
}));

async function loadPostHandler() {
  const routeModule = await import("./route");
  return routeModule.POST;
}

describe("POST /api/v1/story/start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkRateLimitMock.mockReturnValue(true);
    detectBlockedTopicMock.mockReturnValue(null);
    createAdminMock.mockReturnValue({ from: vi.fn(), rpc: vi.fn() });
    trackUserActivityBestEffortMock.mockResolvedValue(undefined);
    consumeDailyAiQuotaMock.mockResolvedValue({ used: 3, remaining: 117 });
    debitBeadsMock.mockResolvedValue(10);
    createStoryThreadMock.mockResolvedValue({
      id: 321,
      raw_text: "",
      able_english: true,
      has_image: true,
    });
    saveKeywordsMock.mockResolvedValue(undefined);
    saveStoryTurnMock.mockResolvedValue(undefined);
    appendThreadRawTextMock.mockResolvedValue(undefined);
    creditBeadsMock.mockResolvedValue(10);
    uploadThreadImageMock.mockResolvedValue(
      "https://cdn.example.com/thread/321/0.png",
    );
    generateStoryTurnMock.mockResolvedValue({
      notice: "첫 장면",
      paragraphs: ["옛날 옛적에..."],
      paragraphsEn: ["Once upon a time..."],
      choices: ["숲으로 간다"],
      choicesEn: ["Go to the forest"],
      imagePrompt: "storybook forest",
    });
    generateStoryImageBase64Mock.mockResolvedValue("base64-image");
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
      json: vi.fn().mockResolvedValue({ keywords: "용기" }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toEqual({ error: "Too many story generation requests" });
  });

  it("returns 400 when keywords are missing", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({ keywords: "  " }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "At least one keyword is required" });
  });

  it("returns 400 when keywords is not a string", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({ keywords: ["용기"] }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "keywords must be a string" });
  });

  it("returns 400 when too many keywords are provided", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({
        keywords: "하나,둘,셋,넷,다섯,여섯,일곱,여덟,아홉",
      }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Too many keywords (max 8)" });
  });

  it("returns 400 when blocked topic is included in keywords", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });

    detectBlockedTopicMock.mockReturnValue("살인");

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({ keywords: "용기, 살인" }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Unsafe content topic is not allowed" });
    expect(generateStoryTurnMock).not.toHaveBeenCalled();
  });

  it("creates story turn and returns messages", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({
        keywords: "용기, 우정",
        includeEnglish: true,
        includeImage: true,
      }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(debitBeadsMock).toHaveBeenCalledWith(
      expect.any(Object),
      "user-1",
      3,
      expect.stringContaining("story:start:user-1:"),
    );
    expect(saveKeywordsMock).toHaveBeenCalledWith(expect.any(Object), 321, [
      "용기",
      "우정",
    ]);
    expect(generateStoryTurnMock).toHaveBeenCalledWith({
      keywords: ["용기", "우정"],
      includeEnglish: true,
    });
    expect(generateStoryImageBase64Mock).toHaveBeenCalledWith(
      "storybook forest",
    );
    expect(uploadThreadImageMock).toHaveBeenCalledWith(
      expect.any(Object),
      "user-1",
      321,
      "base64-image",
    );
    expect(body).toEqual(
      expect.objectContaining({
        threadId: 321,
        turn: 0,
        beadCount: 10,
        includeEnglish: true,
        includeImage: true,
      }),
    );
  });

  it("returns 429 when daily ai quota is exceeded", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    consumeDailyAiQuotaMock.mockRejectedValue(
      new DailyQuotaExceededErrorMock("DAILY_AI_COST_LIMIT_EXCEEDED"),
    );

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({ keywords: "용기" }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toEqual({ error: "Daily AI budget exceeded" });
  });

  it("returns 402 when bead balance is insufficient", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    debitBeadsMock.mockRejectedValue(new Error("INSUFFICIENT_BEADS"));

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({ keywords: "용기" }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(402);
    expect(body).toEqual({ error: "Not enough beads" });
  });

  it("returns 503 when ai service key is not configured", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    generateStoryTurnMock.mockRejectedValue(AiServiceConfigurationErrorMock());

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({ keywords: "용기" }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ error: "AI service is not configured" });
    expect(creditBeadsMock).toHaveBeenCalledWith(
      expect.any(Object),
      "user-1",
      1,
    );
  });

  it("refunds beads when generation fails after debit", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    generateStoryTurnMock.mockRejectedValue(new Error("llm timeout"));

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({ keywords: "용기" }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "Failed to start story" });
    expect(creditBeadsMock).toHaveBeenCalledWith(
      expect.any(Object),
      "user-1",
      1,
    );
  });
});
