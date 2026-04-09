import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  translateKoreanParagraphsMock,
  authenticateRequestMock,
  trackUserActivityBestEffortMock,
  creditBeadsMock,
  debitBeadsMock,
  ensureBeadRowMock,
  getMessagesForThreadMock,
  getThreadForUserMock,
  updateMessageTranslationsMock,
  consumeDailyAiQuotaMock,
  checkRateLimitMock,
  createAdminMock,
  detectBlockedTopicMock,
} = vi.hoisted(() => ({
  translateKoreanParagraphsMock: vi.fn(),
  authenticateRequestMock: vi.fn(),
  trackUserActivityBestEffortMock: vi.fn(),
  creditBeadsMock: vi.fn(),
  debitBeadsMock: vi.fn(),
  ensureBeadRowMock: vi.fn(),
  getMessagesForThreadMock: vi.fn(),
  getThreadForUserMock: vi.fn(),
  updateMessageTranslationsMock: vi.fn(),
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
  translateKoreanParagraphs: translateKoreanParagraphsMock,
}));

vi.mock("@/lib/auth/request-auth", () => ({
  authenticateRequest: authenticateRequestMock,
}));

vi.mock("@/lib/server/analytics", () => ({
  trackUserActivityBestEffort: trackUserActivityBestEffortMock,
}));

vi.mock("@/lib/server/hodam-repo", () => ({
  creditBeads: creditBeadsMock,
  debitBeads: debitBeadsMock,
  ensureBeadRow: ensureBeadRowMock,
  getMessagesForThread: getMessagesForThreadMock,
  getThreadForUser: getThreadForUserMock,
  updateMessageTranslations: updateMessageTranslationsMock,
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

describe("POST /api/v1/story/translate", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    checkRateLimitMock.mockReturnValue(true);
    detectBlockedTopicMock.mockReturnValue(null);
    createAdminMock.mockReturnValue({ from: vi.fn(), rpc: vi.fn() });
    getThreadForUserMock.mockResolvedValue({ id: 321, user_id: "user-1" });
    trackUserActivityBestEffortMock.mockResolvedValue(undefined);
    consumeDailyAiQuotaMock.mockResolvedValue({ used: 1, remaining: 119 });
    debitBeadsMock.mockResolvedValue(7);
    creditBeadsMock.mockResolvedValue(8);
    ensureBeadRowMock.mockResolvedValue({ id: "bead-1", count: 8 });
    getMessagesForThreadMock
      .mockResolvedValueOnce([
        { id: 1, message: "안녕하세요", message_en: null },
        { id: 2, message: "모험을 시작해요", message_en: null },
      ])
      .mockResolvedValueOnce([
        { id: 1, message: "안녕하세요", message_en: "Hello" },
        {
          id: 2,
          message: "모험을 시작해요",
          message_en: "Let's begin adventure",
        },
      ]);
    translateKoreanParagraphsMock.mockResolvedValue([
      "Hello",
      "Let's begin adventure",
    ]);
    updateMessageTranslationsMock.mockResolvedValue(undefined);
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
    expect(body).toEqual({
      error: "Unauthorized",
      code: "AUTH_UNAUTHORIZED",
    });
  });

  it("returns 401 when authenticateRequest throws", async () => {
    authenticateRequestMock.mockRejectedValue(new Error("auth transport down"));
    const POST = await loadPostHandler();

    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({ threadId: 321 }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      error: "Unauthorized",
      code: "AUTH_UNAUTHORIZED",
    });
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
      json: vi.fn().mockResolvedValue({ threadId: 321 }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toEqual({
      error: "Too many translation requests",
      code: "STORY_TRANSLATE_RATE_LIMITED",
    });
  });

  it("returns 400 when threadId is invalid", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    const POST = await loadPostHandler();

    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({ threadId: 0 }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: "Valid threadId is required",
      code: "STORY_TRANSLATE_THREAD_ID_INVALID",
    });
  });

  it("returns 404 when thread does not exist", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    getThreadForUserMock.mockRejectedValue(new Error("THREAD_NOT_FOUND"));

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({ threadId: 999 }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({
      error: "Thread not found",
      code: "THREAD_NOT_FOUND",
    });
  });

  it("translates thread messages and returns updated list", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    const POST = await loadPostHandler();

    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({ threadId: 321 }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(debitBeadsMock).toHaveBeenCalledWith(
      expect.any(Object),
      "user-1",
      1,
      expect.stringContaining("story:translate:user-1:321:"),
    );
    expect(translateKoreanParagraphsMock).toHaveBeenCalledWith([
      "안녕하세요",
      "모험을 시작해요",
    ]);
    expect(updateMessageTranslationsMock).toHaveBeenCalledWith(
      expect.any(Object),
      321,
      ["Hello", "Let's begin adventure"],
    );
    expect(body).toEqual(
      expect.objectContaining({
        threadId: 321,
        beadCount: 7,
      }),
    );
    expect(body.messages).toEqual([
      { id: 1, text: "안녕하세요", text_en: "Hello" },
      { id: 2, text: "모험을 시작해요", text_en: "Let's begin adventure" },
    ]);
  });

  it("returns 400 and refunds when translated output includes blocked topic", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    detectBlockedTopicMock.mockReturnValue("살인");

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({ threadId: 321 }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: "Generated translation contained unsafe topic",
      code: "STORY_TRANSLATE_BLOCKED_OUTPUT",
    });
    expect(updateMessageTranslationsMock).not.toHaveBeenCalled();
    expect(creditBeadsMock).toHaveBeenCalledWith(
      expect.any(Object),
      "user-1",
      1,
    );
  });

  it("returns existing messages without charging when all messages are translated", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    getMessagesForThreadMock.mockReset();
    getMessagesForThreadMock.mockResolvedValue([
      { id: 1, message: "안녕하세요", message_en: "Hello" },
      {
        id: 2,
        message: "모험을 시작해요",
        message_en: "Let's begin adventure",
      },
    ]);

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({ threadId: 321 }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(consumeDailyAiQuotaMock).not.toHaveBeenCalled();
    expect(debitBeadsMock).not.toHaveBeenCalled();
    expect(updateMessageTranslationsMock).not.toHaveBeenCalled();
    expect(body).toEqual({
      threadId: 321,
      beadCount: 8,
      messages: [
        { id: 1, text: "안녕하세요", text_en: "Hello" },
        { id: 2, text: "모험을 시작해요", text_en: "Let's begin adventure" },
      ],
    });
  });

  it("returns 429 when ai quota is exceeded", async () => {
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
      json: vi.fn().mockResolvedValue({ threadId: 321 }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toEqual({
      error: "Daily AI budget exceeded",
      code: "AI_DAILY_BUDGET_EXCEEDED",
    });
  });

  it("returns 402 when beads are insufficient", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    debitBeadsMock.mockRejectedValue(new Error("INSUFFICIENT_BEADS"));

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({ threadId: 321 }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(402);
    expect(body).toEqual({
      error: "Not enough beads",
      code: "BEADS_INSUFFICIENT",
    });
  });

  it("returns 503 when ai service key is not configured", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    translateKoreanParagraphsMock.mockRejectedValue(
      AiServiceConfigurationErrorMock(),
    );

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({ threadId: 321 }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error: "AI service is not configured",
      code: "AI_SERVICE_NOT_CONFIGURED",
    });
    expect(creditBeadsMock).toHaveBeenCalledWith(
      expect.any(Object),
      "user-1",
      1,
    );
  });

  it("refunds beads when translation update fails", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    updateMessageTranslationsMock.mockRejectedValue(new Error("update failed"));

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({ threadId: 321 }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: "Failed to translate story",
      code: "STORY_TRANSLATE_FAILED",
    });
    expect(creditBeadsMock).toHaveBeenCalledWith(
      expect.any(Object),
      "user-1",
      1,
    );
  });
});
