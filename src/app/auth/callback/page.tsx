"use client";

import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { supabase } from "@/app/utils/supabase";

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [message, setMessage] = useState("로그인 처리 중...");

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // URL에서 인증 코드 처리
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Auth callback error:", error);
          setStatus("error");
          setMessage("로그인 처리 중 오류가 발생했습니다.");
          return;
        }

        if (data.session) {
          setStatus("success");
          setMessage("로그인 성공! 메인 페이지로 이동합니다...");

          // 잠시 후 메인 페이지로 리다이렉트
          setTimeout(() => {
            router.push("/");
          }, 1500);
        } else {
          setStatus("error");
          setMessage("로그인 세션을 찾을 수 없습니다.");
        }
      } catch (error) {
        console.error("Unexpected error:", error);
        setStatus("error");
        setMessage("예상치 못한 오류가 발생했습니다.");
      }
    };

    handleAuthCallback();
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 flex items-center justify-center p-4">
      <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/20 p-8 max-w-md w-full text-center">
        {/* 로고 */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-r from-orange-400 to-amber-400 flex items-center justify-center shadow-lg">
            <img
              src="/hodam.png"
              className="w-10 h-10 filter brightness-0 invert"
              alt="호담 로고"
            />
          </div>
        </div>

        {/* 상태별 아이콘 */}
        <div className="mb-6">
          {status === "loading" && (
            <div className="w-12 h-12 mx-auto border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
          )}
          {status === "success" && (
            <div className="w-12 h-12 mx-auto bg-green-100 rounded-full flex items-center justify-center">
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          )}
          {status === "error" && (
            <div className="w-12 h-12 mx-auto bg-red-100 rounded-full flex items-center justify-center">
              <svg
                className="w-6 h-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
          )}
        </div>

        {/* 메시지 */}
        <h2 className="text-xl font-semibold text-gray-800 mb-2">
          {status === "loading" && "로그인 처리 중"}
          {status === "success" && "로그인 성공!"}
          {status === "error" && "로그인 실패"}
        </h2>
        <p className="text-gray-600 mb-6">{message}</p>

        {/* 에러 시 다시 시도 버튼 */}
        {status === "error" && (
          <button
            onClick={() => router.push("/sign-in")}
            className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold py-3 px-6 rounded-2xl transition-all duration-300"
          >
            다시 로그인하기
          </button>
        )}
      </div>
    </div>
  );
}
