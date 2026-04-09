import {
  ContinueStoryResponseSchema,
  StartStoryResponseSchema,
  TranslateStoryResponseSchema,
} from "@/app/api/v1/schemas";
import { runWithStoryRequestRetry } from "@/app/service/story-page-request";
import { authorizedFetch } from "@/lib/client/api/http";

import type { z } from "zod";

type StartStoryResponse = z.infer<typeof StartStoryResponseSchema>;
type ContinueStoryResponse = z.infer<typeof ContinueStoryResponseSchema>;
type TranslateStoryResponse = z.infer<typeof TranslateStoryResponseSchema>;

const STORY_RETRY_OPTIONS = {
  maxAttempts: 2,
} as const;

export interface StartStoryRequestPayload {
  keywords: string;
  includeEnglish: boolean;
  includeImage: boolean;
}

export async function requestStartStory(
  payload: StartStoryRequestPayload,
): Promise<StartStoryResponse> {
  return runWithStoryRequestRetry(
    () =>
      authorizedFetch<StartStoryResponse>(
        "/api/v1/story/start",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
        StartStoryResponseSchema,
      ),
    STORY_RETRY_OPTIONS,
  );
}

export interface ContinueStoryRequestPayload {
  threadId: number;
  selection: string;
}

export async function requestContinueStory(
  payload: ContinueStoryRequestPayload,
): Promise<ContinueStoryResponse> {
  return runWithStoryRequestRetry(
    () =>
      authorizedFetch<ContinueStoryResponse>(
        "/api/v1/story/continue",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
        ContinueStoryResponseSchema,
      ),
    STORY_RETRY_OPTIONS,
  );
}

export interface TranslateStoryRequestPayload {
  threadId: number;
}

export async function requestTranslateStory(
  payload: TranslateStoryRequestPayload,
): Promise<TranslateStoryResponse> {
  return runWithStoryRequestRetry(
    () =>
      authorizedFetch<TranslateStoryResponse>(
        "/api/v1/story/translate",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
        TranslateStoryResponseSchema,
      ),
    STORY_RETRY_OPTIONS,
  );
}
