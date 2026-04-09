import { describe, expect, it, vi } from "vitest";

import {
  exchangeCodeWithSessionFallback,
  waitForAuthSession,
} from "@/app/auth/callback/auth-callback-session";

describe("auth-callback-session", () => {
  describe("waitForAuthSession", () => {
    it("returns session when retried session lookup succeeds", async () => {
      const getSession = vi
        .fn()
        .mockResolvedValueOnce({
          data: { session: null },
        })
        .mockResolvedValueOnce({
          data: { session: { user: { id: "user-1" } } },
        });

      const session = await waitForAuthSession(
        {
          getSession,
        },
        {
          retries: 2,
          waitMs: 0,
          timeoutMs: 30,
        },
      );

      expect(session).toEqual({ user: { id: "user-1" } });
      expect(getSession).toHaveBeenCalledTimes(2);
    });

    it("returns null when retries are exhausted", async () => {
      const getSession = vi.fn().mockResolvedValue({
        data: { session: null },
      });

      const session = await waitForAuthSession(
        {
          getSession,
        },
        {
          retries: 3,
          waitMs: 0,
          timeoutMs: 30,
        },
      );

      expect(session).toBeNull();
      expect(getSession).toHaveBeenCalledTimes(3);
    });
  });

  describe("exchangeCodeWithSessionFallback", () => {
    it("returns terminal result when exchange reports terminal error", async () => {
      const markCodeInFlight = vi.fn();
      const clearCodeMarker = vi.fn();
      const setLoadingMessage = vi.fn();

      const result = await exchangeCodeWithSessionFallback({
        authClient: {
          exchangeCodeForSession: vi.fn().mockResolvedValue({
            data: { session: null },
            error: { message: "invalid_grant: expired" },
          }),
        },
        code: "code-1",
        timeoutMs: 30,
        markCodeInFlight,
        clearCodeMarker,
        setLoadingMessage,
        waitForSession: vi.fn().mockResolvedValue(null),
        isTerminalError: message => Boolean(message?.includes("invalid_grant")),
      });

      expect(result).toEqual({
        session: null,
        errorMessage: "invalid_grant: expired",
        terminal: true,
      });
      expect(markCodeInFlight).toHaveBeenCalledWith("code-1");
      expect(clearCodeMarker).toHaveBeenCalledWith("code-1");
      expect(setLoadingMessage).toHaveBeenCalledWith(
        "로그인 코드를 교환하는 중...",
      );
    });

    it("waits for session when exchange succeeds without immediate session", async () => {
      const waitForSession = vi.fn().mockResolvedValue({
        user: { id: "user-2" },
      });

      const result = await exchangeCodeWithSessionFallback({
        authClient: {
          exchangeCodeForSession: vi.fn().mockResolvedValue({
            data: { session: null },
            error: null,
          }),
        },
        code: "code-2",
        timeoutMs: 30,
        markCodeInFlight: vi.fn(),
        clearCodeMarker: vi.fn(),
        setLoadingMessage: vi.fn(),
        waitForSession,
        isTerminalError: () => false,
      });

      expect(waitForSession).toHaveBeenCalledWith(10, 400);
      expect(result).toEqual({
        session: { user: { id: "user-2" } },
        errorMessage: null,
        terminal: false,
      });
    });
  });
});
