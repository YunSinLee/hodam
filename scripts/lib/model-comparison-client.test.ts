import { beforeEach, describe, expect, it, vi } from "vitest";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("openai", () => ({
  OpenAI: class {
    chat = { completions: { create } };
  },
}));

import {
  evaluation,
  RecordingOpenAI,
  withPicturebookModelTelemetry,
} from "./model-comparison-client.mjs";

describe("comparison request boundary", () => {
  const params = {
    model: "gpt-6-luna",
    temperature: 0.75,
    messages: [{ role: "user", content: "합성 원고" }],
  };
  beforeEach(() => {
    create.mockReset();
    Object.assign(evaluation, {
      calls: [],
      current: { kind: "story", caseId: "synthetic", variant: "candidate" },
      context: null,
      budget: 10,
      stop: null,
      checkpoint: vi.fn(async () => {}),
    });
  });

  it("persists spend reservation before the live call and captures the production phase", async () => {
    create.mockImplementation(async () => {
      expect(evaluation.checkpoint).toHaveBeenCalledOnce();
      expect(evaluation.calls[0]).toMatchObject({
        phase: "draft",
        stage: "start",
        outcome: "pending",
      });
      return {
        model: "gpt-6-luna",
        choices: [{ message: { content: "{}" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 100, completion_tokens: 200 },
      };
    });
    const client = new RecordingOpenAI({ apiKey: "synthetic-test-key" });
    await withPicturebookModelTelemetry(
      { model: params.model, phase: "draft", stage: "start" },
      () => client.chat.completions.create(params, { timeout: 18000 }),
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        reasoning_effort: "low",
        max_completion_tokens: 6000,
      }),
      { timeout: 18000 },
    );
    expect(create.mock.calls[0][0]).not.toHaveProperty("temperature");
    expect(evaluation.calls[0]).toMatchObject({
      outcome: "response",
      finishReason: "stop",
    });
    expect(evaluation.calls[0]).not.toHaveProperty("messages");
    expect(evaluation.context).toBeNull();
    expect(evaluation.checkpoint).toHaveBeenCalledTimes(2);
  });

  it("stops further paid calls immediately on quota failure", async () => {
    create.mockRejectedValue(
      Object.assign(new Error("provider detail"), {
        status: 429,
        code: "insufficient_quota",
      }),
    );
    const client = new RecordingOpenAI({ apiKey: "synthetic-test-key" });
    await expect(
      client.chat.completions.create(params, { timeout: 18000 }),
    ).rejects.toThrow();
    await expect(
      client.chat.completions.create(params, { timeout: 18000 }),
    ).rejects.toThrow();
    expect(create).toHaveBeenCalledOnce();
    expect(evaluation.stop).toMatchObject({
      status: 429,
      code: "insufficient_quota",
    });
    expect(evaluation.calls[0]).toMatchObject({
      reservedUSD: expect.any(Number),
    });
    expect(JSON.stringify(evaluation.calls)).not.toContain("provider detail");
  });

  it("does not call the API when reservation or journal persistence fails", async () => {
    const client = new RecordingOpenAI({ apiKey: "synthetic-test-key" });
    evaluation.budget = 0.00001;
    await expect(
      client.chat.completions.create(params, { timeout: 18000 }),
    ).rejects.toMatchObject({ name: "BudgetLimitError" });
    expect(create).not.toHaveBeenCalled();
    evaluation.budget = 10;
    evaluation.stop = null;
    evaluation.checkpoint = vi.fn(async () => {
      throw new Error("disk unavailable");
    });
    await expect(
      client.chat.completions.create(params, { timeout: 18000 }),
    ).rejects.toThrow("disk unavailable");
    expect(create).not.toHaveBeenCalled();
  });

  it("blocks image requests regardless of credentials", () => {
    const client = new RecordingOpenAI({ apiKey: "synthetic-test-key" });
    expect(() => client.images.generate()).toThrow("Images are disabled");
    expect(create).not.toHaveBeenCalled();
  });
});
