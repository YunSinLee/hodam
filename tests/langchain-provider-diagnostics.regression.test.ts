import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { book, input } from "./fixtures";

const mocks = vi.hoisted(() => {
  vi.stubEnv("OPENAI_API_KEY", "test-only-no-network");
  return { auth: vi.fn(), chat: vi.fn() };
});
vi.mock("server-only", () => ({}));
vi.mock("@/app/api/server-auth", () => ({ requireServerUser: mocks.auth }));
vi.mock("openai", () => ({
  OpenAI: class {
    chat = { completions: { create: mocks.chat } };
    images = { generate: vi.fn() };
  },
}));

import {
  generatePicturebookEnding,
  generatePicturebookStart,
} from "../src/app/api/langchain";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "owner" } });
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());
afterAll(() => vi.unstubAllEnvs());

const connectionMessage =
  "이야기 생성 서비스에 연결할 수 없어요. 운영팀에 문의해주세요.";
const quotaMessage =
  "이야기 생성 서비스의 이용 한도가 소진됐어요. 운영팀에 문의해주세요.";

describe.each(["start", "ending"] as const)(
  "%s provider failure diagnostics",
  stage => {
    it.each([
      {
        detail: { status: 401, code: "invalid_api_key" },
        category: "provider_authentication",
        message: connectionMessage,
        retryable: false,
      },
      {
        detail: { status: 403 },
        category: "provider_permission",
        message: connectionMessage,
        retryable: false,
      },
      {
        detail: { status: 429, code: "rate_limit_exceeded" },
        category: "provider_rate_limit",
        message: "생성 요청이 몰리고 있어요. 잠시 후 다시 시도해주세요.",
        retryable: true,
      },
      {
        detail: { status: 429, code: "insufficient_quota" },
        category: "provider_quota",
        message: quotaMessage,
        retryable: false,
      },
      {
        detail: { code: "credit_balance_exhausted" },
        category: "provider_quota",
        message: quotaMessage,
        retryable: false,
      },
      {
        detail: { type: "insufficient_quota" },
        category: "provider_quota",
        message: quotaMessage,
        retryable: false,
      },
    ])("logs only a fixed category for $category ($detail)", async testCase => {
      const providerError = Object.assign(
        new Error("synthetic provider detail that must never be logged"),
        testCase.detail,
        {
          headers: { authorization: "synthetic-secret" },
          request: { childName: "synthetic-child", prompt: "synthetic-story" },
        },
      );
      mocks.chat.mockRejectedValue(providerError);

      const generate =
        stage === "start"
          ? generatePicturebookStart(input, "token")
          : generatePicturebookEnding(book(), "A", "token");
      await expect(generate).rejects.toMatchObject({
        message: testCase.message,
        retryable: testCase.retryable,
      });
      expect(console.warn).toHaveBeenCalledExactlyOnceWith(
        "picturebook_generation_failed",
        { stage, category: testCase.category },
      );
      expect(mocks.chat).toHaveBeenCalledTimes(1);
    });
  },
);
