"use client";

import { useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import AuthBrandMark from "@/app/components/auth/AuthBrandMark";
import AuthCard from "@/app/components/auth/AuthCard";
import AuthShell from "@/app/components/auth/AuthShell";
import AuthStatusIcon from "@/app/components/auth/AuthStatusIcon";
import { supabase } from "@/app/utils/supabase";
import {
  formatSessionErrorMessage,
  isTerminalSessionExchangeError,
  toSignInRecoveryCode,
  type SignInRecoveryCode,
} from "@/lib/auth/callback-error";
import {
  parseOAuthCallbackPayload,
  resolveOAuthCodeExchangeAction,
} from "@/lib/auth/callback-flow";
import { consumePostLoginRedirectPath } from "@/lib/auth/post-login-redirect";
import { toSessionUserInfo } from "@/lib/auth/session-state";
import useUserInfo from "@/services/hooks/use-user-info";

const AUTH_STEP_TIMEOUT_MS = 15000;
const AUTH_TOTAL_TIMEOUT_MS = 22000;
const AUTH_NO_PAYLOAD_SESSION_TIMEOUT_MS = 5000;
const AUTH_MANUAL_RECOVERY_HINT_MS = 8000;
const OAUTH_CODE_MARKER_PREFIX = "hodam:oauth:code:";
const OAUTH_CODE_MARKER_TTL_MS = 1000 * 60 * 10;

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timeout (${timeoutMs}ms)`));
    }, timeoutMs);

    promise
      .then(result => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function withCodeMarkerKey(code: string): string {
  return `${OAUTH_CODE_MARKER_PREFIX}${code}`;
}

function readCodeMarker(code: string): number | null {
  try {
    const raw = window.sessionStorage.getItem(withCodeMarkerKey(code));
    if (!raw) return null;
    const timestamp = Number(raw);
    if (!Number.isFinite(timestamp)) return null;
    return timestamp;
  } catch {
    return null;
  }
}

function markCodeInFlight(code: string): void {
  try {
    window.sessionStorage.setItem(withCodeMarkerKey(code), String(Date.now()));
  } catch {
    // Ignore sessionStorage failures in restricted browser contexts.
  }
}

function clearCodeMarker(code: string): void {
  try {
    window.sessionStorage.removeItem(withCodeMarkerKey(code));
  } catch {
    // Ignore sessionStorage failures in restricted browser contexts.
  }
}

function hasRecentCodeMarker(code: string): boolean {
  const markerTimestamp = readCodeMarker(code);
  if (!markerTimestamp) return false;

  if (Date.now() - markerTimestamp > OAUTH_CODE_MARKER_TTL_MS) {
    clearCodeMarker(code);
    return false;
  }

  return true;
}

function cleanupExpiredCodeMarkers(): void {
  try {
    const now = Date.now();
    const total = window.sessionStorage.length;
    const keys: string[] = [];
    for (let i = 0; i < total; i += 1) {
      const key = window.sessionStorage.key(i);
      if (key) keys.push(key);
    }

    keys.forEach(key => {
      if (!key.startsWith(OAUTH_CODE_MARKER_PREFIX)) return;
      const raw = window.sessionStorage.getItem(key);
      const timestamp = Number(raw || "");
      if (
        !Number.isFinite(timestamp) ||
        now - timestamp > OAUTH_CODE_MARKER_TTL_MS
      ) {
        window.sessionStorage.removeItem(key);
      }
    });
  } catch {
    // Ignore sessionStorage failures in restricted browser contexts.
  }
}

export default function AuthCallback() {
  const router = useRouter();
  const { setUserInfo } = useUserInfo();
  const handledRef = useRef(false);
  const completedRef = useRef(false);
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [message, setMessage] = useState("로그인 처리 중...");
  const [recoveryCode, setRecoveryCode] =
    useState<SignInRecoveryCode>("callback_failed");
  const [showManualRecovery, setShowManualRecovery] = useState(false);

  useEffect(() => {
    if (handledRef.current) return undefined;
    handledRef.current = true;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let fallbackErrorTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let manualRecoveryHintTimeoutId: ReturnType<typeof setTimeout> | null =
      null;
    let disposed = false;

    const applySessionSuccess = (
      session: Awaited<
        ReturnType<typeof supabase.auth.getSession>
      >["data"]["session"],
    ) => {
      if (disposed || completedRef.current) return true;

      const sessionUserInfo = toSessionUserInfo(session);
      if (!sessionUserInfo) return false;

      completedRef.current = true;
      setUserInfo(sessionUserInfo);
      setStatus("success");
      setMessage("로그인 성공! 메인 페이지로 이동합니다...");
      const redirectTarget = consumePostLoginRedirectPath("/");

      timeoutId = setTimeout(() => {
        router.replace(redirectTarget);
      }, 1200);

      return true;
    };

    const setAuthError = (
      nextMessage: string,
      nextRecoveryCode?: SignInRecoveryCode,
    ) => {
      if (disposed || completedRef.current) return;
      setStatus("error");
      setMessage(nextMessage);
      setRecoveryCode(nextRecoveryCode || toSignInRecoveryCode(nextMessage));
    };

    const setLoadingMessage = (nextMessage: string) => {
      if (disposed || completedRef.current) return;
      setStatus(currentStatus => {
        if (currentStatus !== "loading") return currentStatus;
        setMessage(nextMessage);
        return currentStatus;
      });
    };

    const wait = (ms: number) =>
      new Promise(resolve => {
        setTimeout(resolve, ms);
      });

    const waitForSession = async (
      remainingRetry = 10,
      waitMs = 350,
    ): Promise<
      Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]
    > => {
      const { data } = await withTimeout(
        supabase.auth.getSession(),
        AUTH_STEP_TIMEOUT_MS,
        "getSession",
      );
      const currentSession = data?.session || null;
      if (currentSession) {
        return currentSession;
      }
      if (remainingRetry <= 1) {
        return null;
      }

      await wait(waitMs);
      return waitForSession(remainingRetry - 1, waitMs);
    };

    const exchangeCodeWithFallback = async (code: string) => {
      markCodeInFlight(code);
      setLoadingMessage("로그인 코드를 교환하는 중...");

      const { data: exchangeData, error: exchangeError } = await withTimeout(
        supabase.auth.exchangeCodeForSession(code),
        AUTH_STEP_TIMEOUT_MS,
        "exchangeCodeForSession",
      );

      const exchangeErrorMessage =
        typeof exchangeError?.message === "string"
          ? exchangeError.message
          : null;

      if (
        exchangeErrorMessage &&
        isTerminalSessionExchangeError(exchangeErrorMessage)
      ) {
        clearCodeMarker(code);
        return {
          session: null,
          errorMessage: exchangeErrorMessage,
          terminal: true,
        };
      }

      if (exchangeErrorMessage) {
        clearCodeMarker(code);
      }

      setLoadingMessage("세션을 동기화하는 중...");
      const syncedSession =
        exchangeData.session || (await waitForSession(10, 400));
      if (!syncedSession) {
        clearCodeMarker(code);
      }

      return {
        session: syncedSession,
        errorMessage: exchangeErrorMessage,
        terminal: false,
      };
    };

    const handleAuthCallback = async () => {
      let activeCode: string | null = null;
      try {
        cleanupExpiredCodeMarkers();
        setLoadingMessage("OAuth 응답을 확인하는 중...");

        const currentUrl = new URL(window.location.href);
        const {
          code,
          oauthError,
          accessTokenFromHash,
          refreshTokenFromHash,
          hasCode,
          hasCallbackPayload,
        } = parseOAuthCallbackPayload(currentUrl);
        activeCode = code;

        if (oauthError) {
          setAuthError(
            `OAuth 로그인 오류: ${oauthError}`,
            toSignInRecoveryCode(oauthError),
          );
          return;
        }

        let exchangeErrorMessage: string | null = null;

        if (!hasCallbackPayload) {
          setLoadingMessage("현재 세션을 확인하는 중...");
          const { data: noPayloadSessionData, error: noPayloadSessionError } =
            await withTimeout(
              supabase.auth.getSession(),
              AUTH_NO_PAYLOAD_SESSION_TIMEOUT_MS,
              "sessionWithoutCallbackPayload",
            );

          if (noPayloadSessionError) {
            exchangeErrorMessage = noPayloadSessionError.message;
          }

          if (applySessionSuccess(noPayloadSessionData?.session || null)) {
            return;
          }

          setLoadingMessage("세션 복구를 재시도하는 중...");
          const recoveredSession = await waitForSession(6, 400);
          if (applySessionSuccess(recoveredSession)) {
            return;
          }

          setAuthError(
            "로그인 콜백 정보가 없습니다. 로그인 페이지에서 다시 시도해주세요.",
            "callback_missing",
          );
          return;
        }

        setLoadingMessage("세션 상태를 확인하는 중...");
        const { data: initialSessionData, error: initialSessionError } =
          await withTimeout(
            supabase.auth.getSession(),
            AUTH_STEP_TIMEOUT_MS,
            "initialSession",
          );
        if (initialSessionError) {
          exchangeErrorMessage = initialSessionError.message;
        }

        let { session } = initialSessionData;
        if (applySessionSuccess(session)) {
          return;
        }

        if (!session && hasCode && code) {
          const codeExchangeAction = resolveOAuthCodeExchangeAction({
            hasSession: Boolean(session),
            code,
            hasRecentCodeMarker: hasRecentCodeMarker(code),
          });

          if (codeExchangeAction === "wait_for_existing_exchange") {
            // In dev strict mode, avoid duplicate code exchange across re-mounts.
            setLoadingMessage("이전 로그인 시도를 확인하는 중...");
            session = await waitForSession(12, 400);
            if (!session) {
              clearCodeMarker(code);
              setLoadingMessage(
                "이전 요청이 지연되어 코드를 다시 교환하는 중...",
              );
              const retriedExchange = await exchangeCodeWithFallback(code);
              exchangeErrorMessage =
                retriedExchange.errorMessage || exchangeErrorMessage;
              if (retriedExchange.terminal) {
                setAuthError(
                  formatSessionErrorMessage(exchangeErrorMessage),
                  toSignInRecoveryCode(exchangeErrorMessage),
                );
                return;
              }

              session = retriedExchange.session;
            }
          } else if (codeExchangeAction === "exchange_now") {
            const exchanged = await exchangeCodeWithFallback(code);
            exchangeErrorMessage =
              exchanged.errorMessage || exchangeErrorMessage;
            if (exchanged.terminal) {
              setAuthError(
                formatSessionErrorMessage(exchangeErrorMessage),
                toSignInRecoveryCode(exchangeErrorMessage),
              );
              return;
            }

            session = exchanged.session;
          }
        } else if (!session && accessTokenFromHash && refreshTokenFromHash) {
          setLoadingMessage("세션을 설정하는 중...");
          const { data: setSessionData, error: setSessionError } =
            await withTimeout(
              supabase.auth.setSession({
                access_token: accessTokenFromHash,
                refresh_token: refreshTokenFromHash,
              }),
              AUTH_STEP_TIMEOUT_MS,
              "setSession",
            );
          if (setSessionError) {
            exchangeErrorMessage = setSessionError.message;
            if (isTerminalSessionExchangeError(exchangeErrorMessage)) {
              setAuthError(
                formatSessionErrorMessage(exchangeErrorMessage),
                toSignInRecoveryCode(exchangeErrorMessage),
              );
              return;
            }
          }
          setLoadingMessage("세션을 동기화하는 중...");
          session = setSessionData.session || (await waitForSession(10, 400));
        } else if (!session) {
          setLoadingMessage("세션을 복구하는 중...");
          session = await waitForSession(8, 400);
        }

        if (applySessionSuccess(session)) {
          if (code) {
            clearCodeMarker(code);
          }
          return;
        }

        if (!session?.user) {
          setAuthError(
            formatSessionErrorMessage(exchangeErrorMessage),
            toSignInRecoveryCode(exchangeErrorMessage),
          );
          return;
        }

        setAuthError(
          "로그인 사용자 정보를 불러오지 못했습니다.",
          "callback_failed",
        );
      } catch (error) {
        if (activeCode) {
          clearCodeMarker(activeCode);
        }
        if (error instanceof Error) {
          const isTimeout = error.message.includes("timeout");
          setAuthError(
            isTimeout
              ? "로그인 응답이 지연되고 있습니다. 잠시 후 다시 로그인해주세요."
              : `로그인 처리 중 오류가 발생했습니다. (${error.message})`,
            isTimeout ? "timeout" : toSignInRecoveryCode(error.message),
          );
        } else {
          setAuthError("예상치 못한 오류가 발생했습니다.", "callback_failed");
        }
      }
    };

    const { data: authStateSubscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session?.user) return;
        applySessionSuccess(session);
      },
    );

    fallbackErrorTimeoutId = setTimeout(() => {
      if (disposed || completedRef.current) return;
      setStatus(currentStatus => {
        if (currentStatus !== "loading") return currentStatus;
        setRecoveryCode("timeout");
        setMessage("로그인 처리가 지연되고 있습니다. 다시 로그인해주세요.");
        return "error";
      });
    }, AUTH_TOTAL_TIMEOUT_MS);

    manualRecoveryHintTimeoutId = setTimeout(() => {
      if (disposed || completedRef.current) return;
      setShowManualRecovery(true);
    }, AUTH_MANUAL_RECOVERY_HINT_MS);

    handleAuthCallback();
    return () => {
      disposed = true;
      authStateSubscription.subscription.unsubscribe();
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (fallbackErrorTimeoutId) {
        clearTimeout(fallbackErrorTimeoutId);
      }
      if (manualRecoveryHintTimeoutId) {
        clearTimeout(manualRecoveryHintTimeoutId);
      }
    };
  }, [router, setUserInfo]);

  return (
    <AuthShell>
      <AuthCard className="w-full text-center">
        <AuthBrandMark className="mb-6" />

        <div className="mb-6 flex justify-center">
          <AuthStatusIcon status={status} />
        </div>

        <h2 className="mb-2 text-lg font-semibold text-gray-800 sm:text-xl">
          {status === "loading" && "로그인 처리 중"}
          {status === "success" && "로그인 성공!"}
          {status === "error" && "로그인 실패"}
        </h2>
        <p className="mb-6 text-sm text-gray-600 sm:text-base">{message}</p>

        {status === "loading" && showManualRecovery && (
          <button
            type="button"
            onClick={() =>
              router.push(
                `/sign-in?auth_error=${encodeURIComponent("timeout")}`,
              )
            }
            className="mb-4 w-full rounded-2xl border border-amber-300 bg-amber-50 px-5 py-3 text-sm font-medium text-amber-700 transition-all duration-300 hover:bg-amber-100 sm:text-base"
          >
            로그인이 오래 걸리면 다시 시도하기
          </button>
        )}

        {status === "error" && (
          <button
            type="button"
            onClick={() =>
              router.push(
                `/sign-in?auth_error=${encodeURIComponent(recoveryCode)}`,
              )
            }
            className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-3 text-sm font-semibold text-white transition-all duration-300 hover:from-orange-600 hover:to-amber-600 sm:text-base"
          >
            다시 로그인하기
          </button>
        )}
      </AuthCard>
    </AuthShell>
  );
}
