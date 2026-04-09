"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { AuthProvidersResponse } from "@/app/api/v1/types";
import { scheduleSignInLoadingFailsafe } from "@/app/sign-in/sign-in-loading-failsafe";
import { startOAuthSignInWithMarker } from "@/app/sign-in/sign-in-oauth-flow";
import type {
  SignInPageHandlers,
  SignInPageState,
  SignInProviderAvailabilityState,
  SignInProviderWarningState,
} from "@/app/sign-in/sign-in-page-contract";
import { buildSignInProviderErrorMessage } from "@/app/sign-in/sign-in-provider-error";
import { beginSignInRequest } from "@/app/sign-in/sign-in-request-guard";
import { normalizeOAuthProviderAvailability } from "@/lib/auth/oauth-provider-health";
import { clearOAuthProviderMarker } from "@/lib/auth/oauth-provider-marker";
import { resolveOAuthRedirectUrl } from "@/lib/auth/oauth-redirect";
import {
  clearPostLoginRedirectPath,
  sanitizePostLoginRedirectPath,
  savePostLoginRedirectPath,
} from "@/lib/auth/post-login-redirect";
import { getSignInRecoveryHint } from "@/lib/auth/sign-in-recovery";

const DEFAULT_PROVIDER_AVAILABILITY: SignInProviderAvailabilityState = {
  kakao: true,
  google: true,
};

const DEFAULT_PROVIDER_WARNINGS: SignInProviderWarningState = {
  kakao: null,
  google: null,
};

export default function useSignInPageController(): {
  state: SignInPageState;
  handlers: SignInPageHandlers;
} {
  const [providerAvailability, setProviderAvailability] = useState(
    DEFAULT_PROVIDER_AVAILABILITY,
  );
  const [providerWarnings, setProviderWarnings] = useState(
    DEFAULT_PROVIDER_WARNINGS,
  );
  const [isKakaoLoading, setIsKakaoLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [authConfigWarning, setAuthConfigWarning] = useState<string | null>(
    null,
  );
  const [authProviderWarning, setAuthProviderWarning] = useState<string | null>(
    null,
  );
  const [resolvedRedirectUrl, setResolvedRedirectUrl] = useState<string | null>(
    null,
  );
  const [authErrorCode, setAuthErrorCode] = useState<string | null>(null);
  const activeSignInRequestIdRef = useRef(0);

  const isAnyLoading = isKakaoLoading || isGoogleLoading;
  const recoveryHint = getSignInRecoveryHint(authErrorCode);

  useEffect(() => {
    if (typeof window === "undefined") {
      return () => {};
    }
    let cancelled = false;

    const searchParams = new URLSearchParams(window.location.search);
    const authError = searchParams.get("auth_error");
    setAuthErrorCode(authError);
    if (authError) {
      clearOAuthProviderMarker();
    }

    const rawNextPath = searchParams.get("next");
    const safeNextPath = sanitizePostLoginRedirectPath(rawNextPath);
    if (safeNextPath) {
      savePostLoginRedirectPath(safeNextPath);
    } else {
      clearPostLoginRedirectPath();
    }

    const { warnings, redirectTo } = resolveOAuthRedirectUrl({
      runtimeOrigin: window.location.origin,
      configuredSiteUrl: process.env.NEXT_PUBLIC_SITE_URL,
      configuredAuthRedirectUrl: process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL,
    });
    setResolvedRedirectUrl(redirectTo);

    if (warnings.length > 0) {
      setAuthConfigWarning(warnings.join(" "));
    }

    const loadProviderHealth = async () => {
      try {
        const response = await fetch("/api/v1/auth/providers", {
          method: "GET",
          cache: "no-store",
        });
        if (!response.ok || cancelled) {
          return;
        }

        const payload = (await response.json()) as AuthProvidersResponse;
        if (cancelled) {
          return;
        }

        const parsed = normalizeOAuthProviderAvailability(payload);
        setProviderAvailability(parsed.availability);
        setProviderWarnings(parsed.providerWarnings);
        setAuthProviderWarning(
          parsed.warnings.length > 0 ? parsed.warnings.join(" ") : null,
        );
      } catch {
        // Ignore diagnostics fetch failures and keep sign-in buttons available.
      }
    };

    loadProviderHealth();

    return () => {
      cancelled = true;
    };
  }, []);

  const signInWithProvider = useCallback(
    async (provider: "kakao" | "google") => {
      if (isAnyLoading) return;

      const isCurrentRequest = beginSignInRequest(activeSignInRequestIdRef);
      const setLoading =
        provider === "kakao" ? setIsKakaoLoading : setIsGoogleLoading;
      setLoading(true);
      setErrorMessage(null);
      const clearLoadingFailsafe = scheduleSignInLoadingFailsafe({
        provider,
        setLoading: loading => {
          if (isCurrentRequest()) {
            setLoading(loading);
          }
        },
        setErrorMessage: message => {
          if (isCurrentRequest()) {
            setErrorMessage(message);
          }
        },
      });

      try {
        await startOAuthSignInWithMarker(provider);
      } catch (error) {
        if (isCurrentRequest()) {
          setErrorMessage(buildSignInProviderErrorMessage(provider, error));
        }
      } finally {
        clearLoadingFailsafe();
        if (isCurrentRequest()) {
          setLoading(false);
        }
      }
    },
    [isAnyLoading],
  );

  const state: SignInPageState = {
    providerAvailability,
    providerWarnings,
    isKakaoLoading,
    isGoogleLoading,
    isAnyLoading,
    errorMessage,
    authConfigWarning,
    authProviderWarning,
    resolvedRedirectUrl,
    recoveryHint,
  };

  const handlers: SignInPageHandlers = {
    signInWithProvider,
  };

  return {
    state,
    handlers,
  };
}
