import { afterAll, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => {
  vi.stubEnv("OPENAI_API_KEY", "test-only-no-network");
  return { image: vi.fn(), auth: vi.fn() };
});
vi.mock("server-only", () => ({}));
vi.mock("@/app/api/server-auth", () => ({ requireServerUser: mocks.auth }));
vi.mock("openai", () => ({
  OpenAI: class {
    images = { generate: mocks.image };
  },
}));
import { generatePicturebookPageImage } from "../src/app/api/langchain";
afterAll(() => vi.unstubAllEnvs());
it("uses the supported image API contract with explicit quality and no retired response_format", async () => {
  mocks.auth.mockResolvedValue({ user: { id: "owner" } });
  mocks.image.mockResolvedValue({ data: [{ b64_json: "AQ==" }] });
  const result = await generatePicturebookPageImage(
    {
      title: "작은 용기",
      childName: "하루",
      pageNumber: 1,
      textKo: "문을 열었어요.",
      imagePrompt: "A child near a door",
    },
    "token",
  );
  expect(result).toEqual({ data: [{ b64_json: "AQ==" }] });
  expect(mocks.image).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      model: "gpt-image-2.5-flare",
      quality: "low",
      output_format: "png",
      size: "1024x1024",
      n: 1,
    }),
    { timeout: 45000 },
  );
  expect(mocks.image.mock.calls[0][0]).not.toHaveProperty("response_format");
});
