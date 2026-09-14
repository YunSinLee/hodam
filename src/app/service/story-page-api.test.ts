import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ContinueStoryResponseSchema,
  StartStoryResponseSchema,
  TranslateStoryResponseSchema,
} from "@/app/api/v1/schemas";

const { authorizedFetchMock, runWithStoryRequestRetryMock } = vi.hoisted(
  () => ({
    authorizedFetchMock: vi.fn(),
    runWithStoryRequestRetryMock: vi.fn(),
  }),
);

vi.mock("@/lib/client/api/http", () => ({
  authorizedFetch: authorizedFetchMock,
}));

vi.mock("@/app/service/story-page-request", () => ({
  runWithStoryRequestRetry: runWithStoryRequestRetryMock,
}));

async function loadStoryPageApiModule() {
  return import("./story-page-api");
}

describe("story-page-api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runWithStoryRequestRetryMock.mockImplementation(
      async (request: () => Promise<unknown>) => request(),
    );
  });

  it("requests start story with schema and retry options", async () => {
    const apiModule = await loadStoryPageApiModule();
    authorizedFetchMock.mockResolvedValue({ threadId: 1 });

    await apiModule.requestStartStory({
      keywords: "숲, 토끼",
      includeEnglish: true,
      includeImage: false,
    });

    expect(runWithStoryRequestRetryMock).toHaveBeenCalledWith(
      expect.any(Function),
      {
        maxAttempts: 2,
      },
    );
    expect(authorizedFetchMock).toHaveBeenCalledWith(
      "/api/v1/story/start",
      {
        method: "POST",
        body: JSON.stringify({
          keywords: "숲, 토끼",
          includeEnglish: true,
          includeImage: false,
        }),
      },
      StartStoryResponseSchema,
    );
  });

  it("requests continue story with schema and retry options", async () => {
    const apiModule = await loadStoryPageApiModule();
    authorizedFetchMock.mockResolvedValue({ messages: [] });

    await apiModule.requestContinueStory({
      threadId: 7,
      selection: "숲으로 간다",
    });

    expect(runWithStoryRequestRetryMock).toHaveBeenCalledWith(
      expect.any(Function),
      {
        maxAttempts: 2,
      },
    );
    expect(authorizedFetchMock).toHaveBeenCalledWith(
      "/api/v1/story/continue",
      {
        method: "POST",
        body: JSON.stringify({
          threadId: 7,
          selection: "숲으로 간다",
        }),
      },
      ContinueStoryResponseSchema,
    );
  });

  it("requests translate story with schema and retry options", async () => {
    const apiModule = await loadStoryPageApiModule();
    authorizedFetchMock.mockResolvedValue({ messages: [] });

    await apiModule.requestTranslateStory({
      threadId: 9,
    });

    expect(runWithStoryRequestRetryMock).toHaveBeenCalledWith(
      expect.any(Function),
      {
        maxAttempts: 2,
      },
    );
    expect(authorizedFetchMock).toHaveBeenCalledWith(
      "/api/v1/story/translate",
      {
        method: "POST",
        body: JSON.stringify({
          threadId: 9,
        }),
      },
      TranslateStoryResponseSchema,
    );
  });
});
