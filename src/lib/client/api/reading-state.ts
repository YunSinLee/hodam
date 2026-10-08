import {
  ReadingStatePageSchema,
  ReadingStateSaveSchema,
} from "@/lib/picturebook/reading-state";
import type { ReadingStateInput } from "@/lib/picturebook/reading-state";

import { authorizedFetch } from "./http";

const readingStateApi = {
  list(ownerId: string, after?: number, signal?: AbortSignal) {
    return authorizedFetch(
      `/api/v1/reading-library${after ? `?after=${after}` : ""}`,
      {
        method: "GET",
        cache: "no-store",
        signal,
        headers: { "x-hodam-owner-id": ownerId },
      },
      ReadingStatePageSchema,
    );
  },
  save(
    ownerId: string,
    bookId: number,
    input: ReadingStateInput,
    signal?: AbortSignal,
  ) {
    return authorizedFetch(
      `/api/v1/threads/${bookId}/reading-state`,
      {
        method: "PUT",
        cache: "no-store",
        signal,
        headers: { "x-hodam-owner-id": ownerId },
        body: JSON.stringify(input),
      },
      ReadingStateSaveSchema,
    );
  },
};

export default readingStateApi;
