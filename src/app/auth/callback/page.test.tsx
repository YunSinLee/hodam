import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import AuthCallbackPage from "@/app/auth/callback/page";
import useAuthCallbackController from "@/app/auth/callback/useAuthCallbackController";

vi.mock("@/app/auth/callback/useAuthCallbackController", () => ({
  default: vi.fn(),
}));

const mockUseAuthCallbackController =
  useAuthCallbackController as unknown as Mock;

describe("Auth callback page", () => {
  beforeEach(() => {
    mockUseAuthCallbackController.mockReset();
  });

  it("renders loading state with manual recovery CTA", () => {
    mockUseAuthCallbackController.mockReturnValue({
      state: {
        status: "loading",
        message: "로그인 처리 중...",
        showManualRecovery: true,
        recoveryCode: "timeout",
        autoRecoveryNotice: null,
        showDebugEvents: false,
        debugEvents: [],
        debugAttemptId: null,
        debugFetchNotice: null,
      },
      handlers: {
        onManualRecoveryClick: () => {},
        onRetryClick: () => {},
        onSuccessClick: () => {},
        onRefreshDebugEvents: () => {},
      },
    });

    const html = renderToStaticMarkup(createElement(AuthCallbackPage));

    expect(html).toContain("로그인 처리 중");
    expect(html).toContain("로그인이 오래 걸리면 다시 시도하기");
  });

  it("renders error retry action", () => {
    mockUseAuthCallbackController.mockReturnValue({
      state: {
        status: "error",
        message: "로그인 실패",
        showManualRecovery: false,
        recoveryCode: "callback_failed",
        autoRecoveryNotice: null,
        showDebugEvents: false,
        debugEvents: [],
        debugAttemptId: null,
        debugFetchNotice: null,
      },
      handlers: {
        onManualRecoveryClick: () => {},
        onRetryClick: () => {},
        onSuccessClick: () => {},
        onRefreshDebugEvents: () => {},
      },
    });

    const html = renderToStaticMarkup(createElement(AuthCallbackPage));

    expect(html).toContain("로그인 실패");
    expect(html).toContain("다시 로그인하기");
  });

  it("renders success continue action", () => {
    mockUseAuthCallbackController.mockReturnValue({
      state: {
        status: "success",
        message: "로그인 성공!",
        showManualRecovery: false,
        recoveryCode: "callback_failed",
        autoRecoveryNotice: null,
        showDebugEvents: false,
        debugEvents: [],
        debugAttemptId: null,
        debugFetchNotice: null,
      },
      handlers: {
        onManualRecoveryClick: () => {},
        onRetryClick: () => {},
        onSuccessClick: () => {},
        onRefreshDebugEvents: () => {},
      },
    });

    const html = renderToStaticMarkup(createElement(AuthCallbackPage));

    expect(html).toContain("로그인 성공!");
    expect(html).toContain("계속하기");
  });
});
