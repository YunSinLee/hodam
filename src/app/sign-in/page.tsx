"use client";

import AuthAlert from "@/app/components/auth/AuthAlert";
import AuthBrandMark from "@/app/components/auth/AuthBrandMark";
import AuthCard from "@/app/components/auth/AuthCard";
import AuthShell from "@/app/components/auth/AuthShell";
import SocialLoginButton from "@/app/components/auth/SocialLoginButton";
import useSignInPageController from "@/app/sign-in/useSignInPageController";

export default function SignIn() {
  const { state, handlers } = useSignInPageController();

  return (
    <AuthShell>
      <div className="space-y-3 sm:space-y-4">
        {state.errorMessage && (
          <AuthAlert tone="error">{state.errorMessage}</AuthAlert>
        )}

        {state.recoveryHint && (
          <AuthAlert tone="warning">
            이전 로그인 시도 안내: {state.recoveryHint}
          </AuthAlert>
        )}

        {state.authConfigWarning && (
          <AuthAlert tone="warning">
            로그인 설정 점검 필요: {state.authConfigWarning}
          </AuthAlert>
        )}

        {state.authProviderWarning && (
          <AuthAlert tone="warning">
            OAuth provider 점검: {state.authProviderWarning}
          </AuthAlert>
        )}

        {!state.authConfigWarning && state.resolvedRedirectUrl && (
          <AuthAlert tone="neutral" className="break-all text-xs">
            OAuth callback URL: {state.resolvedRedirectUrl}
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
              loading={state.isKakaoLoading}
              disabled={state.isAnyLoading || !state.providerAvailability.kakao}
              disabledReason={
                !state.providerAvailability.kakao
                  ? state.providerWarnings.kakao
                  : null
              }
              onClick={() => handlers.signInWithProvider("kakao")}
            />

            <SocialLoginButton
              provider="google"
              loading={state.isGoogleLoading}
              disabled={
                state.isAnyLoading || !state.providerAvailability.google
              }
              disabledReason={
                !state.providerAvailability.google
                  ? state.providerWarnings.google
                  : null
              }
              onClick={() => handlers.signInWithProvider("google")}
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
