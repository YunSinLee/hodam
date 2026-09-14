import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  vi.stubEnv("OPENAI_API_KEY", "synthetic-test-key");
  return { chat: vi.fn() };
});
vi.mock("server-only", () => ({}));
vi.mock("@/app/api/server-auth", () => ({
  requireServerUser: async () => ({ user: { id: "qa" } }),
}));
vi.mock("openai", () => ({
  OpenAI: class {
    chat = { completions: { create: mocks.chat } };
  },
}));

import { generatePicturebookStart } from "../src/app/api/langchain";
import { input } from "./fixtures";

afterEach(() => vi.restoreAllMocks());

describe("picturebook failure diagnostics", () => {
  it.each([
    ["APIConnectionTimeoutError", "timeout"],
    ["APIConnectionError", "connection"],
    ["Error", "model_or_response"],
  ])(
    "records %s without logging private input or provider error bodies",
    async (name, category) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const failure = new Error("private-child-text provider-secret");
      failure.name = name;
      mocks.chat.mockRejectedValueOnce(failure);
      await expect(
        generatePicturebookStart(input, "private-access-token"),
      ).rejects.toThrow("이야기를 만들지 못했어요");
      expect(warn).toHaveBeenCalledWith("picturebook_generation_failed", {
        stage: "start",
        category,
      });
      expect(JSON.stringify(warn.mock.calls)).not.toMatch(
        /private|provider-secret|민준/,
      );
    },
  );
});
