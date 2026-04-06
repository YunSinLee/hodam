import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  generateStoryTurnMock,
  authenticateRequestMock,
  trackUserActivityBestEffortMock,
  appendThreadRawTextMock,
  creditBeadsMock,
  debitBeadsMock,
  getNextTurnMock,
  getThreadForUserMock,
  saveStoryTurnMock,
  consumeDailyAiQuotaMock,
  checkRateLimitMock,
  createAdminMock,
  detectBlockedTopicMock,
} = vi.hoisted(() => ({
  generateStoryTurnMock: vi.fn(),
  authenticateRequestMock: vi.fn(),
  trackUserActivityBestEffortMock: vi.fn(),
  appendThreadRawTextMock: vi.fn(),
  creditBeadsMock: vi.fn(),
  debitBeadsMock: vi.fn(),
  getNextTurnMock: vi.fn(),
  getThreadForUserMock: vi.fn(),
  saveStoryTurnMock: vi.fn(),
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
  debitBeads: debitBeadsMock,
  getNextTurn: getNextTurnMock,
  getThreadForUser: getThreadForUserMock,
  saveStoryTurn: saveStoryTurnMock,
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

describe("POST /api/v1/story/continue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkRateLimitMock.mockReturnValue(true);
    detectBlockedTopicMock.mockReturnValue(null);
    createAdminMock.mockReturnValue({ from: vi.fn(), rpc: vi.fn() });
    consumeDailyAiQuotaMock.mockResolvedValue({ used: 4, remaining: 116 });
    debitBeadsMock.mockResolvedValue(8);
    getThreadForUserMock.mockResolvedValue({
      id: 321,
      user_id: "user-1",
      raw_text: "이전 줄거리",
      able_english: true,
    });
    creditBeadsMock.mockResolvedValue(10);
    getNextTurnMock.mockResolvedValue(3);
    saveStoryTurnMock.mockResolvedValue(undefined);
    appendThreadRawTextMock.mockResolvedValue(undefined);
    trackUserActivityBestEffortMock.mockResolvedValue(undefined);
    generateStoryTurnMock.mockResolvedValue({
      notice: "다음 장면",
      paragraphs: ["주인공이 앞으로 나아갔다."],
      paragraphsEn: ["The hero moved forward."],
      choices: ["문을 연다"],
      choicesEn: ["Open the door"],
    });
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

  it("returns 400 when threadId is invalid", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    const POST = await loadPostHandler();

    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({ threadId: 0, selection: "선택지" }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Valid threadId is required" });
  });

  it("returns 400 when selection is empty", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    const POST = await loadPostHandler();

    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({ threadId: 1, selection: "   " }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Selection is required" });
  });

  it("returns 400 when selection is too long", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    const POST = await loadPostHandler();

    const response = await POST({
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({
        threadId: 1,
        selection: "가".repeat(201),
      }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: "Selection is too long (max 200 characters)",
    });
  });

  it("returns 400 when selection contains blocked topic", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    detectBlockedTopicMock.mockReturnValue("자살");

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers(),
      json: vi
        .fn()
        .mockResolvedValue({ threadId: 1, selection: "자살을 한다" }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Unsafe content topic is not allowed" });
    expect(generateStoryTurnMock).not.toHaveBeenCalled();
  });

  it("returns 404 when thread cannot be found", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    getThreadForUserMock.mockRejectedValue(new Error("THREAD_NOT_FOUND"));

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers(),
      json: vi
        .fn()
        .mockResolvedValue({ threadId: 999, selection: "문을 연다" }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: "Thread not found" });
  });

  it("continues story and returns next turn payload", async () => {
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
        .mockResolvedValue({ threadId: 321, selection: "문을 연다" }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(debitBeadsMock).toHaveBeenCalledWith(
      expect.any(Object),
      "user-1",
      2,
      expect.stringContaining("story:continue:user-1:321:"),
    );
    expect(generateStoryTurnMock).toHaveBeenCalledWith({
      storyContext: "이전 줄거리",
      userSelection: "문을 연다",
      includeEnglish: true,
    });
    expect(body).toEqual(
      expect.objectContaining({
        threadId: 321,
        turn: 3,
        beadCount: 8,
      }),
    );
  });

  it("returns 429 when ai daily quota is exceeded", async () => {
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
      json: vi
        .fn()
        .mockResolvedValue({ threadId: 321, selection: "문을 연다" }),
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
      json: vi
        .fn()
        .mockResolvedValue({ threadId: 321, selection: "문을 연다" }),
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
      json: vi
        .fn()
        .mockResolvedValue({ threadId: 321, selection: "문을 연다" }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ error: "AI service is not configured" });
    expect(creditBeadsMock).toHaveBeenCalledWith(
      expect.any(Object),
      "user-1",
      2,
    );
  });

  it("refunds beads when saving story turn fails", async () => {
    authenticateRequestMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user@example.com",
    });
    saveStoryTurnMock.mockRejectedValue(new Error("db write timeout"));

    const POST = await loadPostHandler();
    const response = await POST({
      headers: new Headers(),
      json: vi
        .fn()
        .mockResolvedValue({ threadId: 321, selection: "문을 연다" }),
    } as never);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "Failed to continue story" });
    expect(creditBeadsMock).toHaveBeenCalledWith(
      expect.any(Object),
      "user-1",
      2,
    );
  });
});
