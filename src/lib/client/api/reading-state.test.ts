import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ReadingStatePageSchema,
  ReadingStateSaveSchema,
} from "@/lib/picturebook/reading-state";

import { authorizedFetch } from "./http";
import readingStateApi from "./reading-state";

vi.mock("./http", () => ({ authorizedFetch: vi.fn() }));

describe("reading state API client", () => {
  beforeEach(() => vi.mocked(authorizedFetch).mockReset());

  it("scopes paginated reads to the expected owner and propagates cancellation", async () => {
    const controller = new AbortController();
    await readingStateApi.list("owner-a", 42, controller.signal);
    expect(authorizedFetch).toHaveBeenCalledWith(
      "/api/v1/reading-library?after=42",
      {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
        headers: { "x-hodam-owner-id": "owner-a" },
      },
      ReadingStatePageSchema,
    );
  });

  it("sends a field-specific compare-and-swap write with an owner guard", async () => {
    const input = {
      field: "favorite" as const,
      expectedVersion: 3,
      favorite: false,
    };
    const controller = new AbortController();
    await readingStateApi.save("owner-a", 11, input, controller.signal);
    expect(authorizedFetch).toHaveBeenCalledWith(
      "/api/v1/threads/11/reading-state",
      {
        method: "PUT",
        cache: "no-store",
        signal: controller.signal,
        headers: { "x-hodam-owner-id": "owner-a" },
        body: JSON.stringify(input),
      },
      ReadingStateSaveSchema,
    );
  });
});
