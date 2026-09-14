import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import AuthCallbackStatusCard from "@/app/components/auth/AuthCallbackStatusCard";

describe("AuthCallbackStatusCard", () => {
  it("renders manual recovery button while loading when hint is visible", () => {
    const html = renderToStaticMarkup(
      createElement(AuthCallbackStatusCard, {
        status: "loading",
        message: "로그인 처리 중...",
        showManualRecovery: true,
        recoveryCode: "timeout",
        autoRecoveryNotice: null,
        showDebugEvents: false,
        debugEvents: [],
        debugAttemptId: null,
        debugFetchNotice: null,
        onManualRecoveryClick: vi.fn(),
        onRetryClick: vi.fn(),
        onRefreshDebugEvents: vi.fn(),
      }),
    );

    expect(html).toContain("로그인 처리 중");
    expect(html).toContain("로그인이 오래 걸리면 다시 시도하기");
  });

  it("renders retry button for error state", () => {
    const html = renderToStaticMarkup(
      createElement(AuthCallbackStatusCard, {
        status: "error",
        message: "로그인 실패",
        showManualRecovery: false,
        recoveryCode: "callback_failed",
        autoRecoveryNotice: null,
        showDebugEvents: false,
        debugEvents: [],
        debugAttemptId: null,
        debugFetchNotice: null,
        onManualRecoveryClick: vi.fn(),
        onRetryClick: vi.fn(),
        onRefreshDebugEvents: vi.fn(),
      }),
    );

    expect(html).toContain("로그인 실패");
    expect(html).toContain("다시 로그인하기");
  });

  it("renders continue button for success state when action is provided", () => {
    const html = renderToStaticMarkup(
      createElement(AuthCallbackStatusCard, {
        status: "success",
        message: "로그인 성공!",
        showManualRecovery: false,
        recoveryCode: "callback_failed",
        autoRecoveryNotice: null,
        showDebugEvents: false,
        debugEvents: [],
        debugAttemptId: null,
        debugFetchNotice: null,
        onManualRecoveryClick: vi.fn(),
        onRetryClick: vi.fn(),
        onSuccessClick: vi.fn(),
        onRefreshDebugEvents: vi.fn(),
      }),
    );

    expect(html).toContain("로그인 성공!");
    expect(html).toContain("계속하기");
  });

  it("renders debug event panel when debug mode is enabled", () => {
    const html = renderToStaticMarkup(
      createElement(AuthCallbackStatusCard, {
        status: "loading",
        message: "로그인 처리 중...",
        showManualRecovery: false,
        recoveryCode: "timeout",
        autoRecoveryNotice: null,
        showDebugEvents: true,
        debugEvents: [
          {
            stage: "flow_start",
            callbackPath: "/auth/callback",
            timestampMs: 1710000000000,
          },
        ],
        debugAttemptId: "attempt-abc-123",
        debugFetchNotice: "최근 이벤트 조회에 실패했습니다.",
        onManualRecoveryClick: vi.fn(),
        onRetryClick: vi.fn(),
        onRefreshDebugEvents: vi.fn(),
      }),
    );

    expect(html).toContain("디버그 이벤트");
    expect(html).toContain("flow_start");
    expect(html).toContain("시도 ID");
    expect(html).toContain("attempt-abc-123");
    expect(html).toContain("최근 이벤트 다시 조회");
  });

  it("renders auto recovery notice in error state", () => {
    const html = renderToStaticMarkup(
      createElement(AuthCallbackStatusCard, {
        status: "error",
        message: "로그인 응답이 지연되고 있습니다.",
        showManualRecovery: true,
        recoveryCode: "timeout",
        autoRecoveryNotice: "응답 지연으로 5초 후 로그인 페이지로 이동합니다.",
        showDebugEvents: false,
        debugEvents: [],
        debugAttemptId: null,
        debugFetchNotice: null,
        onManualRecoveryClick: vi.fn(),
        onRetryClick: vi.fn(),
        onRefreshDebugEvents: vi.fn(),
      }),
    );

    expect(html).toContain("응답 지연으로 5초 후 로그인 페이지로 이동합니다.");
  });
});
