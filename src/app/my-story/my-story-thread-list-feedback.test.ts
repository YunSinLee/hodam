import { describe, expect, it } from "vitest";

import { resolveMyStoryThreadListFeedback } from "@/app/my-story/my-story-thread-list-feedback";

describe("resolveMyStoryThreadListFeedback", () => {
  it("returns error when thread list is unavailable", () => {
    const feedback = resolveMyStoryThreadListFeedback(
      {
        threads: [],
        diagnostics: {
          source: "none",
          degraded: true,
          reasons: ["rpc_error", "fallback_error"],
        },
      },
      {
        isDevelopment: false,
      },
    );

    expect(feedback).toEqual({
      errorMessage:
        "동화 목록을 불러오는 중 일시적인 서버 문제가 발생했습니다. 잠시 후 다시 시도해주세요.",
      warningMessage: null,
    });
  });

  it("returns degraded warning with diagnostics in development", () => {
    const feedback = resolveMyStoryThreadListFeedback(
      {
        threads: [{ id: 1 } as never],
        diagnostics: {
          source: "fallback",
          degraded: true,
          reasons: ["rpc_error"],
        },
      },
      {
        isDevelopment: true,
      },
    );

    expect(feedback).toEqual({
      errorMessage: null,
      warningMessage:
        "동화 목록 조회가 지연되어 보조 경로로 처리되었습니다. (source=fallback, reasons=rpc_error)",
    });
  });

  it("returns error when thread list request failed with 5xx fallback reason", () => {
    const feedback = resolveMyStoryThreadListFeedback(
      {
        threads: [],
        diagnostics: {
          source: "none",
          degraded: true,
          reasons: ["request_failed_500"],
        },
      },
      {
        isDevelopment: false,
      },
    );

    expect(feedback).toEqual({
      errorMessage:
        "동화 목록을 불러오는 중 일시적인 서버 문제가 발생했습니다. 잠시 후 다시 시도해주세요.",
      warningMessage: null,
    });
  });

  it("returns no messages when thread list is healthy", () => {
    const feedback = resolveMyStoryThreadListFeedback(
      {
        threads: [{ id: 1 } as never],
        diagnostics: {
          source: "rpc",
          degraded: false,
          reasons: [],
        },
      },
      {
        isDevelopment: false,
      },
    );

    expect(feedback).toEqual({
      errorMessage: null,
      warningMessage: null,
    });
  });
});
