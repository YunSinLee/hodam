/* eslint-disable no-console -- Assert the exact privacy-safe logging contract. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  type PicturebookModelContext,
  withPicturebookModelTelemetry,
} from "./model-telemetry";

const context: PicturebookModelContext = {
  model: "gpt-5.4-2026-03-05",
  phase: "draft",
  stage: "start",
};

describe("picturebook model telemetry", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(performance, "now")
      .mockReturnValueOnce(100)
      .mockReturnValue(124.6);
  });
  afterEach(() => vi.restoreAllMocks());

  it("records only API usage numbers while preserving the complete response", async () => {
    const response = {
      id: "provider-request-private",
      choices: [{ message: { content: "아이의 비공개 이야기" } }],
      usage: {
        prompt_tokens: 1200,
        completion_tokens: 500,
        total_tokens: 1700,
        prompt_tokens_details: { cached_tokens: 400, private: "child name" },
        completion_tokens_details: { reasoning_tokens: 180 },
        arbitrary_private_field: "sk-secret",
      },
    };
    const privateContext = {
      ...context,
      childName: "개인정보",
      accessToken: "secret-token",
    };
    const result = await withPicturebookModelTelemetry(
      privateContext,
      async () => response,
    );
    expect(result).toBe(response);
    expect(console.info).toHaveBeenCalledExactlyOnceWith(
      "picturebook_model_call",
      {
        model: context.model,
        phase: "draft",
        stage: "start",
        elapsedMs: 25,
        outcome: "success",
        usage: {
          inputTokens: 1200,
          outputTokens: 500,
          totalTokens: 1700,
          cachedInputTokens: 400,
          reasoningTokens: 180,
        },
      },
    );
  });

  it("separates image and text token counts without logging the image or URL", async () => {
    const response = {
      data: [{ b64_json: "private-pixels", url: "https://private-story" }],
      usage: {
        input_tokens: 700,
        output_tokens: 250,
        total_tokens: 950,
        input_tokens_details: { text_tokens: 650, image_tokens: 50 },
        output_tokens_details: { image_tokens: 250, text_tokens: 0 },
      },
    };
    await withPicturebookModelTelemetry(
      { model: "gpt-image-2.5-flare", phase: "image", stage: "image" },
      async () => response,
    );
    expect(console.info).toHaveBeenCalledExactlyOnceWith(
      "picturebook_model_call",
      {
        model: "gpt-image-2.5-flare",
        phase: "image",
        stage: "image",
        elapsedMs: 25,
        outcome: "success",
        usage: {
          inputTokens: 700,
          outputTokens: 250,
          totalTokens: 950,
          inputTextTokens: 650,
          inputImageTokens: 50,
          outputImageTokens: 250,
          outputTextTokens: 0,
        },
      },
    );
  });

  it.each([undefined, null, {}, [], { total_tokens: "123" }])(
    "leaves absent or unusable usage unknown: %j",
    async usage => {
      await withPicturebookModelTelemetry(context, async () => ({ usage }));
      expect(vi.mocked(console.info).mock.calls[0][1]).not.toHaveProperty(
        "usage",
      );
    },
  );

  it("keeps explicit zero but ignores negative, fractional, infinite and unsafe counts", async () => {
    await withPicturebookModelTelemetry(context, async () => ({
      usage: {
        prompt_tokens: -1,
        completion_tokens: 2.5,
        total_tokens: Infinity,
        prompt_tokens_details: { cached_tokens: 0 },
        completion_tokens_details: { reasoning_tokens: Number.MAX_VALUE },
      },
    }));
    expect(vi.mocked(console.info).mock.calls[0][1]).toHaveProperty("usage", {
      cachedInputTokens: 0,
    });
  });

  it("does not invoke usage getters or use inherited counts", async () => {
    const getter = vi.fn(() => "private-data");
    const usage = Object.create({ prompt_tokens: 10 });
    Object.defineProperty(usage, "completion_tokens", { get: getter });
    await withPicturebookModelTelemetry(context, async () => ({ usage }));
    expect(getter).not.toHaveBeenCalled();
    expect(vi.mocked(console.info).mock.calls[0][1]).not.toHaveProperty(
      "usage",
    );
  });

  it("preserves failures without logging error messages, headers, bodies or usage", async () => {
    const error = Object.assign(new Error("child story sk-private-api-key"), {
      body: { prompt: "private scene" },
      headers: { Authorization: "private-token" },
      usage: { prompt_tokens: 500 },
    });
    await expect(
      withPicturebookModelTelemetry(
        { ...context, phase: "review", stage: "ending" },
        async () => {
          throw error;
        },
      ),
    ).rejects.toBe(error);
    expect(console.info).toHaveBeenCalledExactlyOnceWith(
      "picturebook_model_call",
      {
        model: context.model,
        phase: "review",
        stage: "ending",
        elapsedMs: 25,
        outcome: "failure",
      },
    );
  });

  it("redacts unrecognized model configuration instead of leaking a misplaced key", async () => {
    await withPicturebookModelTelemetry(
      { ...context, model: "sk-proj-private-secret" },
      async () => ({}),
    );
    expect(vi.mocked(console.info).mock.calls[0][1]).toHaveProperty(
      "model",
      "unrecognized",
    );
  });

  it("retains independent timings when calls overlap", async () => {
    vi.mocked(performance.now)
      .mockReset()
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(20)
      .mockReturnValueOnce(45)
      .mockReturnValueOnce(70);
    let finishFirst: (value: object) => void = () => undefined;
    const first = withPicturebookModelTelemetry(
      context,
      () =>
        new Promise<object>(resolve => {
          finishFirst = resolve;
        }),
    );
    await withPicturebookModelTelemetry(
      { ...context, phase: "repair" },
      async () => ({}),
    );
    finishFirst({});
    await first;
    expect(vi.mocked(console.info).mock.calls.map(call => call[1])).toEqual([
      expect.objectContaining({ phase: "repair", elapsedMs: 25 }),
      expect.objectContaining({ phase: "draft", elapsedMs: 60 }),
    ]);
  });

  it("does not turn a successful paid call into a retry if logging fails", async () => {
    vi.mocked(console.info).mockImplementation(() => {
      throw new Error("log unavailable");
    });
    const response = { usage: { prompt_tokens: 100 } };
    const invoke = vi.fn(async () => response);
    await expect(withPicturebookModelTelemetry(context, invoke)).resolves.toBe(
      response,
    );
    expect(invoke).toHaveBeenCalledOnce();
  });
});
