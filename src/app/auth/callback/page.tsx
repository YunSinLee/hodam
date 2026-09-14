"use client";

import { useEffect, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { safeReturnPath } from "@/app/utils/navigation";
import { supabase } from "@/app/utils/supabase";

export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState(false);
  const [next, setNext] = useState("/service");
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const destination = safeReturnPath(params.get("next"));
    setNext(destination);
    const complete = async () => {
      if (params.has("error")) throw new Error("OAuth failed");
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data.session) throw new Error("No session");
      if (active) router.replace(destination);
    };
    complete().catch(() => {
      if (active) setError(true);
    });
    return () => {
      active = false;
    };
  }, [router]);
  return (
    <div className="auth-page">
      <h1>{error ? "로그인을 마치지 못했어요" : "책장을 열고 있어요"}</h1>
      <p role={error ? "alert" : "status"}>
        {error
          ? "로그인이 취소되었거나 연결이 끊겼어요. 다시 시도해주세요."
          : "로그인 정보를 확인한 뒤 작성하던 화면으로 돌아갑니다."}
      </p>
      {error && (
        <Link
          className="button-primary"
          href={`/sign-in?next=${encodeURIComponent(next)}`}
        >
          다시 로그인하기
        </Link>
      )}
    </div>
  );
}
