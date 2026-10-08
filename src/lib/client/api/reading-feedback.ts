import {
  ReadingFeedbackResponseSchema,
  type ReadingFeedbackInput,
} from "@/lib/picturebook/reading-feedback";

import { authorizedFetch } from "./http";

const readingFeedbackApi = {
  async get(threadId: number, ownerId: string, signal?: AbortSignal) {
    return authorizedFetch(
      `/api/v1/threads/${threadId}/feedback`,
      {
        method: "GET",
        headers: { "x-hodam-owner-id": ownerId },
        signal,
        cache: "no-store",
      },
      ReadingFeedbackResponseSchema,
    );
  },
  async save(
    threadId: number,
    ownerId: string,
    feedback: ReadingFeedbackInput,
    signal?: AbortSignal,
  ) {
    return authorizedFetch(
      `/api/v1/threads/${threadId}/feedback`,
      {
        method: "PUT",
        headers: { "x-hodam-owner-id": ownerId },
        body: JSON.stringify(feedback),
        signal,
      },
      ReadingFeedbackResponseSchema,
    );
  },
};

export default readingFeedbackApi;
