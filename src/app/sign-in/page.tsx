"use client";

import { useEffect, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import userApi from "@/app/api/user";
import { safeReturnPath } from "@/app/utils/navigation";
import useUserInfo from "@/services/hooks/use-user-info";

export default function SignIn() {
  const [loading, setLoading] = useState<"kakao" | "google" | null>(null);
  const [error, setError] = useState("");
  const { userInfo, isAuthReady } = useUserInfo();
  const router = useRouter();
  useEffect(() => {
    if (isAuthReady && userInfo.id)
      router.replace(
        safeReturnPath(new URLSearchParams(window.location.search).get("next")),
      );
  }, [isAuthReady, userInfo.id, router]);
  async function signIn(provider: "kakao" | "google") {
    if (loading) return;
    setLoading(provider);
    setError("");
    const next = safeReturnPath(
      new URLSearchParams(window.location.search).get("next"),
    );
    try {
      if (provider === "kakao") await userApi.signInWithKakao(next);
      else await userApi.signInWithGoogle(next);
    } catch {
      setError(
        "로그인을 시작하지 못했어요. 연결을 확인하고 다시 시도해주세요.",
      );
    } finally {
      setLoading(null);
    }
  }
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
      {error && (
        <p className="notice-error" role="alert">
          {error}
        </p>
      )}
      <div className="auth-buttons">
        <button
          type="button"
          onClick={() => signIn("kakao")}
          disabled={!!loading}
        >
          <img src="/kakao_logo.svg" alt="" />
          {loading === "kakao" ? "카카오로 이동 중…" : "카카오로 시작하기"}
        </button>
        <button
          type="button"
          onClick={() => signIn("google")}
          disabled={!!loading}
        >
          <img src="/google_logo.svg" alt="" />
          {loading === "google" ? "Google로 이동 중…" : "Google로 시작하기"}
        </button>
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
