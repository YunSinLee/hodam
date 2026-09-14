"use client";

import Image from "next/image";
import Link from "next/link";

import useSignInPageController from "@/app/sign-in/useSignInPageController";

export default function SignIn() {
  const { state, handlers } = useSignInPageController();

  return (
    <div className="auth-page">
      <p className="eyebrow">우리 아이의 작은 책장</p>
      <h1>
        오늘의 이야기를
        <br />
        간직해볼까요?
      </h1>
      <p>
        카카오 또는 Google 계정으로 시작하세요.
        <br />
        로그인하면 작성하던 화면으로 돌아가요.
      </p>
      {state.errorMessage && (
        <p className="notice-error" role="alert">
          {state.errorMessage}
        </p>
      )}
      {state.recoveryHint && (
        <p className="notice-error" role="status">
          이전 로그인 시도 안내: {state.recoveryHint}
        </p>
      )}
      <div className="auth-buttons">
        <button
          type="button"
          onClick={() => handlers.signInWithProvider("kakao")}
          disabled={state.isAnyLoading || !state.providerAvailability.kakao}
          aria-describedby={
            !state.providerAvailability.kakao ? "kakao-unavailable" : undefined
          }
        >
          <Image src="/kakao_logo.svg" alt="" width={24} height={24} />
          {state.isKakaoLoading ? "카카오로 이동 중…" : "카카오로 시작하기"}
        </button>
        {!state.providerAvailability.kakao && (
          <p id="kakao-unavailable" className="notice-error">
            지금은 카카오 로그인을 사용할 수 없어요. 잠시 후 다시 시도해주세요.
          </p>
        )}
        <button
          type="button"
          onClick={() => handlers.signInWithProvider("google")}
          disabled={state.isAnyLoading || !state.providerAvailability.google}
          aria-describedby={
            !state.providerAvailability.google
              ? "google-unavailable"
              : undefined
          }
        >
          <Image src="/google_logo.svg" alt="" width={24} height={24} />
          {state.isGoogleLoading ? "Google로 이동 중…" : "Google로 시작하기"}
        </button>
        {!state.providerAvailability.google && (
          <p id="google-unavailable" className="notice-error">
            지금은 Google 로그인을 사용할 수 없어요. 잠시 후 다시 시도해주세요.
          </p>
        )}
      </div>
      <div className="auth-footnote">
        <p>
          서비스 이용 전 <Link href="/terms">이용약관</Link>과{" "}
          <Link href="/privacy">개인정보처리방침</Link>을 확인해주세요.
        </p>
        <Link className="text-link inline-block mt-6" href="/sample">
          로그인 없이 그림책 먼저 읽기 →
        </Link>
      </div>
    </div>
  );
}
