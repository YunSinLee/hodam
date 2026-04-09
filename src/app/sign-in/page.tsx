"use client";

import AuthAlert from "@/app/components/auth/AuthAlert";
import AuthBrandMark from "@/app/components/auth/AuthBrandMark";
import AuthCard from "@/app/components/auth/AuthCard";
import AuthShell from "@/app/components/auth/AuthShell";
import SocialLoginButton from "@/app/components/auth/SocialLoginButton";
import useSignInPageController from "@/app/sign-in/useSignInPageController";

const BENEFIT_ITEMS = [
  "키워드 기반 동화 즉시 생성",
  "선택형 분기 전개로 인터랙션 강화",
  "영어 번역/이미지 생성 옵션 확장",
] as const;

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

            <h1 className="hodam-heading text-3xl text-[#2f3033] sm:text-4xl">
              10초 만에 로그인하고
              <br />
              오늘의 동화를 시작하세요
            </h1>
            <p className="mt-3 text-sm text-[#6b7280] sm:text-base">
              카카오 또는 Google 계정으로 바로 시작할 수 있습니다.
            </p>
          </header>

          <div className="mb-5 rounded-2xl border border-[#ef8d3d]/20 bg-[#fff8ef] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#a05a1a]">
              로그인 후 가능 기능
            </p>
            <ul className="mt-2 space-y-1.5 text-sm text-[#4b5563]">
              {BENEFIT_ITEMS.map(item => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>

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
            <p className="text-sm leading-relaxed text-[#6b7280]">
              로그인하시면{" "}
              <a
                href="/terms"
                className="font-semibold text-[#b45f1c] underline hover:text-[#9f5116]"
              >
                이용약관
              </a>
              과{" "}
              <a
                href="/privacy"
                className="font-semibold text-[#b45f1c] underline hover:text-[#9f5116]"
              >
                개인정보처리방침
              </a>
              에 동의하는 것으로 간주됩니다.
            </p>
          </footer>
        </AuthCard>

        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#ef8d3d]/20 bg-white/70 px-4 py-2 text-xs text-[#9b5518] sm:text-sm">
            <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-[#ef8d3d]" />
            베타 서비스 운영 중
          </div>
        </div>
      </div>
    </AuthShell>
  );
}
