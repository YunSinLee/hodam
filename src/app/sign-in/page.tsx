"use client";

import { useEffect, useState } from "react";

import AuthAlert from "@/app/components/auth/AuthAlert";
import AuthBrandMark from "@/app/components/auth/AuthBrandMark";
import AuthCard from "@/app/components/auth/AuthCard";
import AuthShell from "@/app/components/auth/AuthShell";
import SocialLoginButton from "@/app/components/auth/SocialLoginButton";
import { resolveOAuthRedirectUrl } from "@/lib/auth/oauth-redirect";
import {
  clearPostLoginRedirectPath,
  sanitizePostLoginRedirectPath,
  savePostLoginRedirectPath,
} from "@/lib/auth/post-login-redirect";
import { getSignInRecoveryHint } from "@/lib/auth/sign-in-recovery";
import userApi from "@/lib/client/api/user";

export default function SignIn() {
  const [isKakaoLoading, setIsKakaoLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [authConfigWarning, setAuthConfigWarning] = useState<string | null>(
    null,
  );
  const [resolvedRedirectUrl, setResolvedRedirectUrl] = useState<string | null>(
    null,
  );
  const [authErrorCode, setAuthErrorCode] = useState<string | null>(null);

  const recoveryHint = getSignInRecoveryHint(authErrorCode);
  const isAnyLoading = isKakaoLoading || isGoogleLoading;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const searchParams = new URLSearchParams(window.location.search);
    setAuthErrorCode(searchParams.get("auth_error"));

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
  }, []);

  async function signInWithProvider(provider: "kakao" | "google") {
    if (isAnyLoading) return;

    const setLoading =
      provider === "kakao" ? setIsKakaoLoading : setIsGoogleLoading;
    setLoading(true);
    setErrorMessage(null);

    try {
      if (provider === "kakao") {
        await userApi.signInWithKakao();
      } else {
        await userApi.signInWithGoogle();
      }
    } catch (error) {
      const providerLabel = provider === "kakao" ? "카카오" : "구글";
      const detail = error instanceof Error ? ` (${error.message})` : "";
      setErrorMessage(
        `${providerLabel} 로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.${detail}`,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <div className="space-y-3 sm:space-y-4">
        {errorMessage && <AuthAlert tone="error">{errorMessage}</AuthAlert>}

        {recoveryHint && (
          <AuthAlert tone="warning">
            이전 로그인 시도 안내: {recoveryHint}
          </AuthAlert>
        )}

        {authConfigWarning && (
          <AuthAlert tone="warning">
            로그인 설정 점검 필요: {authConfigWarning}
          </AuthAlert>
        )}

        {!authConfigWarning && resolvedRedirectUrl && (
          <AuthAlert tone="neutral" className="break-all text-xs">
            OAuth callback URL: {resolvedRedirectUrl}
          </AuthAlert>
        )}

        <AuthCard>
          <header className="mb-7 text-center sm:mb-8">
            <AuthBrandMark size="lg" className="mb-5 sm:mb-6" />

            <h1 className="mb-2 bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-2xl font-bold text-transparent sm:text-3xl">
              호담에 오신 것을 환영합니다
            </h1>
            <p className="text-base text-gray-600 sm:text-lg">
              AI와 함께 만드는 나만의 동화
            </p>
          </header>

          <div className="space-y-3 sm:space-y-4">
            <SocialLoginButton
              provider="kakao"
              loading={isKakaoLoading}
              disabled={isAnyLoading}
              onClick={() => signInWithProvider("kakao")}
            />

            <SocialLoginButton
              provider="google"
              loading={isGoogleLoading}
              disabled={isAnyLoading}
              onClick={() => signInWithProvider("google")}
            />
          </div>

          <footer className="mt-7 text-center sm:mt-8">
            <p className="text-sm leading-relaxed text-gray-500">
              로그인하시면{" "}
              <a
                href="/terms"
                className="text-orange-600 underline hover:text-orange-700"
              >
                이용약관
              </a>
              과{" "}
              <a
                href="/privacy"
                className="text-orange-600 underline hover:text-orange-700"
              >
                개인정보처리방침
              </a>
              에 동의하는 것으로 간주됩니다.
            </p>
          </footer>
        </AuthCard>

        <div className="text-center">
          <div className="inline-flex items-center gap-2 text-gray-400">
            <div className="h-2 w-2 animate-pulse rounded-full bg-orange-300" />
            <span className="text-xs sm:text-sm">
              AI 동화 생성의 새로운 경험
            </span>
            <div className="h-2 w-2 animate-pulse rounded-full bg-amber-300 [animation-delay:300ms]" />
          </div>
        </div>
      </div>
    </AuthShell>
  );
}
