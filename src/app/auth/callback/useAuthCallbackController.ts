"use client";

import { useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import {
  AUTH_CALLBACK_AUTO_RECOVERY_DELAY_MS,
  getAuthCallbackAutoRecoveryNotice,
  scheduleAuthCallbackRecoveryRedirect,
} from "@/app/auth/callback/auth-callback-auto-recovery";
import type {
  AuthCallbackPageHandlers,
  AuthCallbackPageState,
} from "@/app/auth/callback/auth-callback-contract";
import {
  AUTH_CALLBACK_LOADING_TIMEOUT_MESSAGE,
  resolveUnexpectedAuthCallbackError,
} from "@/app/auth/callback/auth-callback-error-state";
import type { AuthCallbackMetricPayload } from "@/app/auth/callback/auth-callback-metric-contract";
import {
  appendFetchedAuthCallbackMetrics,
  createAuthCallbackMetricEmitter,
  fetchAuthCallbackRecentMetrics,
} from "@/app/auth/callback/auth-callback-metrics";
import { scheduleAuthCallbackRedirect } from "@/app/auth/callback/auth-callback-navigation";
import {
  exchangeCodeWithSessionFallback,
  waitForAuthSession,
} from "@/app/auth/callback/auth-callback-session";
import {
  AUTH_MANUAL_RECOVERY_HINT_MS,
  AUTH_NO_PAYLOAD_SESSION_TIMEOUT_MS,
  AUTH_STEP_TIMEOUT_MS,
  AUTH_TOTAL_TIMEOUT_MS,
  withTimeout,
} from "@/app/auth/callback/auth-callback-timeout";
import { supabase } from "@/app/utils/supabase";
import {
  formatSessionErrorMessage,
  isRecoverableSessionExchangeError,
  isTerminalSessionExchangeError,
  toSignInRecoveryCode,
  type SignInRecoveryCode,
} from "@/lib/auth/callback-error";
import {
  parseOAuthCallbackPayload,
  resolveOAuthCodeExchangeAction,
} from "@/lib/auth/callback-flow";
import type { AuthCallbackStatus } from "@/lib/auth/callback-status";
import {
  cleanupExpiredOAuthCodeMarkers,
  clearOAuthCodeMarker,
  hasRecentOAuthCodeMarker,
  markOAuthCodeInFlight,
} from "@/lib/auth/oauth-code-marker";
import {
  clearOAuthProviderMarker,
  readRecentOAuthProviderMarker,
} from "@/lib/auth/oauth-provider-marker";
import { consumePostLoginRedirectPath } from "@/lib/auth/post-login-redirect";
import { toSessionUserInfo } from "@/lib/auth/session-state";
import useUserInfo from "@/services/hooks/use-user-info";

export default function useAuthCallbackController() {
  const router = useRouter();
  const { setUserInfo } = useUserInfo();
  const handledRef = useRef(false);
  const completedRef = useRef(false);
  const redirectTargetRef = useRef<string>("/");
  const [status, setStatus] = useState<AuthCallbackStatus>("loading");
  const [message, setMessage] = useState("로그인 처리 중...");
  const [recoveryCode, setRecoveryCode] =
    useState<SignInRecoveryCode>("callback_failed");
  const [showManualRecovery, setShowManualRecovery] = useState(false);
  const [autoRecoveryNotice, setAutoRecoveryNotice] = useState<string | null>(
    null,
  );
  const [showDebugEvents, setShowDebugEvents] = useState(false);
  const [debugEvents, setDebugEvents] = useState<AuthCallbackMetricPayload[]>(
    [],
  );
  const [debugAttemptId, setDebugAttemptId] = useState<string | null>(null);
  const [debugFetchNotice, setDebugFetchNotice] = useState<string | null>(null);
  const refreshDebugEventsRef = useRef<() => void>(() => {});
  const statusRef = useRef<AuthCallbackStatus>("loading");

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (handledRef.current) return undefined;
    handledRef.current = true;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let fallbackErrorTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let manualRecoveryHintTimeoutId: ReturnType<typeof setTimeout> | null =
      null;
    let autoRecoveryRedirectCleanup: (() => void) | null = null;
    let debugEventSyncIntervalId: ReturnType<typeof setInterval> | null = null;
    let debugEventsFetchInFlight = false;
    let redirectFallbackCleanup: (() => void) | null = null;
    let disposed = false;
    const callbackUrl = new URL(window.location.href);
    const emitMetric = createAuthCallbackMetricEmitter(callbackUrl);
    const callbackMarker = readRecentOAuthProviderMarker();
    const callbackProvider = callbackMarker?.provider || null;
    const callbackAttemptId = callbackMarker?.attemptId || null;
    const callbackMarkerAgeMs = callbackMarker
      ? Math.max(0, Date.now() - callbackMarker.timestampMs)
      : null;
    const isDebugMode =
      callbackUrl.searchParams.get("auth_debug") === "1" ||
      process.env.NEXT_PUBLIC_AUTH_CALLBACK_DEBUG === "1";

    const syncDebugEvents = () => {
      if (!isDebugMode) return;
      const nextEvents = Array.isArray(window.__HODAM_AUTH_CALLBACK_METRICS__)
        ? [...window.__HODAM_AUTH_CALLBACK_METRICS__]
        : [];
      setDebugEvents(nextEvents);
    };

    const syncPersistedDebugEvents = async () => {
      if (!isDebugMode || !callbackAttemptId || debugEventsFetchInFlight) {
        return;
      }

      debugEventsFetchInFlight = true;
      try {
        const result = await fetchAuthCallbackRecentMetrics(callbackAttemptId, {
          limit: 50,
        });
        if (disposed) {
          return;
        }
        if (!result) {
          setDebugFetchNotice("최근 이벤트 조회에 실패했습니다.");
          return;
        }
        if (result.degraded) {
          setDebugFetchNotice(
            `서버 진단 조회 제한 상태입니다 (${result.degradedReason || "unknown"}).`,
          );
        } else if (result.events.length === 0) {
          setDebugFetchNotice("아직 서버에 기록된 이벤트가 없습니다.");
        } else {
          setDebugFetchNotice(null);
        }

        if (result.events.length > 0) {
          appendFetchedAuthCallbackMetrics(result.events);
          syncDebugEvents();
        }
      } finally {
        debugEventsFetchInFlight = false;
      }
    };

    const triggerPersistedDebugSync = () => {
      syncPersistedDebugEvents().catch(() => {
        // Keep debug metric fetch failures non-blocking.
      });
    };

    const emitAndSyncMetric = (
      stage: Parameters<typeof emitMetric>[0],
      details?: Parameters<typeof emitMetric>[1],
    ) => {
      emitMetric(stage, {
        ...(details || {}),
        ...(callbackProvider ? { provider: callbackProvider } : {}),
        ...(callbackAttemptId ? { oauthAttemptId: callbackAttemptId } : {}),
        ...(callbackMarkerAgeMs !== null
          ? { oauthProviderMarkerAgeMs: callbackMarkerAgeMs }
          : { oauthProviderMarkerMissing: true }),
      });
      syncDebugEvents();
    };

    setShowDebugEvents(isDebugMode);
    setDebugAttemptId(callbackAttemptId);
    if (!callbackAttemptId) {
      setDebugFetchNotice("시도 ID가 없어 서버 이벤트를 조회할 수 없습니다.");
    } else {
      setDebugFetchNotice(null);
    }
    syncDebugEvents();
    triggerPersistedDebugSync();
    refreshDebugEventsRef.current = () => {
      syncDebugEvents();
      triggerPersistedDebugSync();
    };
    if (isDebugMode) {
      debugEventSyncIntervalId = setInterval(() => {
        syncDebugEvents();
        triggerPersistedDebugSync();
      }, 1000);
    }

    const applySessionSuccess = (
      session: Awaited<
        ReturnType<typeof supabase.auth.getSession>
      >["data"]["session"],
    ) => {
      if (disposed || completedRef.current) return true;

      const sessionUserInfo = toSessionUserInfo(session);
      if (!sessionUserInfo) return false;

      if (autoRecoveryRedirectCleanup) {
        autoRecoveryRedirectCleanup();
        autoRecoveryRedirectCleanup = null;
      }
      completedRef.current = true;
      setUserInfo(sessionUserInfo);
      statusRef.current = "success";
      setStatus("success");
      setMessage("로그인 성공! 메인 페이지로 이동합니다...");
      setAutoRecoveryNotice(null);
      const redirectTarget = consumePostLoginRedirectPath("/");
      redirectTargetRef.current = redirectTarget;
      emitAndSyncMetric("callback_success", {
        redirectTarget,
      });
      clearOAuthProviderMarker();

      timeoutId = setTimeout(() => {
        redirectFallbackCleanup = scheduleAuthCallbackRedirect({
          router,
          targetPath: redirectTarget,
        });
      }, 1200);

      return true;
    };

    const clearAutoRecoveryRedirect = () => {
      if (autoRecoveryRedirectCleanup) {
        autoRecoveryRedirectCleanup();
        autoRecoveryRedirectCleanup = null;
      }
      setAutoRecoveryNotice(null);
    };

    const setAuthError = (
      nextMessage: string,
      nextRecoveryCode?: SignInRecoveryCode,
    ) => {
      if (disposed || completedRef.current) return;
      const resolvedRecoveryCode =
        nextRecoveryCode || toSignInRecoveryCode(nextMessage);
      statusRef.current = "error";
      setStatus("error");
      setMessage(nextMessage);
      setRecoveryCode(resolvedRecoveryCode);
      setShowManualRecovery(true);
      emitAndSyncMetric("callback_error", {
        recoveryCode: resolvedRecoveryCode,
      });
      if (resolvedRecoveryCode === "timeout" && !isDebugMode) {
        clearAutoRecoveryRedirect();
        setAutoRecoveryNotice(
          getAuthCallbackAutoRecoveryNotice(
            AUTH_CALLBACK_AUTO_RECOVERY_DELAY_MS,
          ),
        );
        autoRecoveryRedirectCleanup = scheduleAuthCallbackRecoveryRedirect({
          router,
          recoveryCode: resolvedRecoveryCode,
          delayMs: AUTH_CALLBACK_AUTO_RECOVERY_DELAY_MS,
        });
      } else {
        clearAutoRecoveryRedirect();
      }
      clearOAuthProviderMarker();
    };

    const setLoadingMessage = (nextMessage: string) => {
      if (disposed || completedRef.current) return;
      setStatus(currentStatus => {
        if (currentStatus !== "loading") return currentStatus;
        setMessage(nextMessage);
        return currentStatus;
      });
    };

    const waitForSession = async (
      remainingRetry = 10,
      waitMs = 350,
    ): Promise<
      Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]
    > => {
      emitAndSyncMetric("wait_for_session_start", {
        retries: remainingRetry,
        waitMs,
      });
      const session = await waitForAuthSession(
        {
          getSession: () => supabase.auth.getSession(),
        },
        {
          retries: remainingRetry,
          waitMs,
          timeoutMs: AUTH_STEP_TIMEOUT_MS,
        },
      );
      emitAndSyncMetric("wait_for_session_complete", {
        retries: remainingRetry,
        waitMs,
        foundSession: Boolean(session),
      });
      return session;
    };

    const exchangeCodeWithFallback = async (code: string) => {
      emitAndSyncMetric("exchange_start", {
        hasCode: Boolean(code),
      });
      const result = await exchangeCodeWithSessionFallback({
        authClient: {
          exchangeCodeForSession: nextCode =>
            supabase.auth.exchangeCodeForSession(nextCode),
        },
        code,
        timeoutMs: AUTH_STEP_TIMEOUT_MS,
        markCodeInFlight: markOAuthCodeInFlight,
        clearCodeMarker: clearOAuthCodeMarker,
        setLoadingMessage,
        waitForSession,
        isTerminalError: isTerminalSessionExchangeError,
      });
      emitAndSyncMetric(
        result.terminal ? "exchange_terminal_error" : "exchange_complete",
        {
          hasSession: Boolean(result.session),
          hasError: Boolean(result.errorMessage),
        },
      );

      if (
        result.terminal &&
        isRecoverableSessionExchangeError(result.errorMessage)
      ) {
        setLoadingMessage("세션을 다시 확인하는 중...");
        const recoveredSession = await waitForSession(8, 400);
        emitAndSyncMetric("wait_for_session_complete", {
          source: "recoverable_exchange_error",
          foundSession: Boolean(recoveredSession),
        });
        if (recoveredSession) {
          return {
            session: recoveredSession,
            errorMessage: result.errorMessage,
            terminal: false,
          };
        }
      }
      return result;
    };

    const handleAuthCallback = async () => {
      let activeCode: string | null = null;
      try {
        cleanupExpiredOAuthCodeMarkers();
        emitAndSyncMetric("flow_start");
        setLoadingMessage("OAuth 응답을 확인하는 중...");
        const {
          code,
          oauthError,
          accessTokenFromHash,
          refreshTokenFromHash,
          hasCode,
          hasTokenPair,
          hasCallbackPayload,
        } = parseOAuthCallbackPayload(callbackUrl);
        activeCode = code;
        emitAndSyncMetric("payload_parsed", {
          hasCode,
          hasTokenPair,
          hasCallbackPayload,
          hasOAuthError: Boolean(oauthError),
        });

        if (oauthError) {
          emitAndSyncMetric("oauth_error", {
            recoveryCode: toSignInRecoveryCode(oauthError),
          });
          setAuthError(
            `OAuth 로그인 오류: ${oauthError}`,
            toSignInRecoveryCode(oauthError),
          );
          return;
        }

        let exchangeErrorMessage: string | null = null;

        if (!hasCallbackPayload) {
          emitAndSyncMetric("no_payload_session_check_start");
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
            emitAndSyncMetric("no_payload_session_recovered", {
              source: "initial_get_session",
            });
            return;
          }

          setLoadingMessage("세션 복구를 재시도하는 중...");
          const recoveredSession = await waitForSession(6, 400);
          if (applySessionSuccess(recoveredSession)) {
            emitAndSyncMetric("no_payload_session_recovered", {
              source: "wait_for_session",
            });
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
            hasRecentCodeMarker: hasRecentOAuthCodeMarker(code),
          });

          if (codeExchangeAction === "wait_for_existing_exchange") {
            setLoadingMessage("이전 로그인 시도를 확인하는 중...");
            session = await waitForSession(12, 400);
            if (!session) {
              clearOAuthCodeMarker(code);
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
          emitAndSyncMetric("set_session_start");
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
          emitAndSyncMetric("set_session_complete", {
            hasSession: Boolean(session),
            hasError: Boolean(setSessionError),
          });
        } else if (!session) {
          setLoadingMessage("세션을 복구하는 중...");
          session = await waitForSession(8, 400);
        }

        if (applySessionSuccess(session)) {
          if (code) {
            clearOAuthCodeMarker(code);
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
          clearOAuthCodeMarker(activeCode);
        }
        const resolved = resolveUnexpectedAuthCallbackError(error);
        setAuthError(resolved.message, resolved.recoveryCode);
      }
    };

    const { data: authStateSubscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        emitAndSyncMetric("wait_for_session_complete", {
          source: "auth_state_change",
          event,
          foundSession: Boolean(session),
          foundUser: Boolean(session?.user),
        });
        if (!session?.user) return;
        applySessionSuccess(session);
      },
    );

    fallbackErrorTimeoutId = setTimeout(() => {
      if (disposed || completedRef.current) return;
      if (statusRef.current !== "loading") return;

      emitAndSyncMetric("fallback_timeout_triggered");
      setAuthError(AUTH_CALLBACK_LOADING_TIMEOUT_MESSAGE, "timeout");
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
      clearAutoRecoveryRedirect();
      if (debugEventSyncIntervalId) {
        clearInterval(debugEventSyncIntervalId);
      }
      if (redirectFallbackCleanup) {
        redirectFallbackCleanup();
      }
      refreshDebugEventsRef.current = () => {};
    };
  }, [router, setUserInfo]);

  const handlers: AuthCallbackPageHandlers = {
    onManualRecoveryClick: () =>
      router.push(`/sign-in?auth_error=${encodeURIComponent("timeout")}`),
    onRetryClick: (nextRecoveryCode: SignInRecoveryCode) =>
      router.push(
        `/sign-in?auth_error=${encodeURIComponent(nextRecoveryCode)}`,
      ),
    onSuccessClick: () => router.replace(redirectTargetRef.current),
    onRefreshDebugEvents: () => refreshDebugEventsRef.current(),
  };

  const state: AuthCallbackPageState = {
    status,
    message,
    showManualRecovery,
    recoveryCode,
    autoRecoveryNotice,
    showDebugEvents,
    debugEvents,
    debugAttemptId,
    debugFetchNotice,
  };

  return {
    state,
    handlers,
  };
}
