"use client";

import { useState } from "react";

import userApi from "@/app/api/user";
// import useUserInfo from "@/services/hooks/use-user-info";

export default function SignIn() {
  const [isKakaoLoading, setIsKakaoLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState("");

  async function signinWithKakao() {
    if (isKakaoLoading || isGoogleLoading) return;

    setIsKakaoLoading(true);
    try {
      console.log("카카오 로그인 시도 중...");
      const result = await userApi.signInWithKakao();
      console.log("카카오 로그인 결과:", result);

      if (result) {
        setWelcomeMessage("카카오 로그인 성공! 잠시 후 이동합니다...");
      }
    } catch (error) {
      console.error("Kakao login error:", error);
    } finally {
      setIsKakaoLoading(false);
    }
  }

  async function signinWithGoogle() {
    if (isKakaoLoading || isGoogleLoading) return;

    setIsGoogleLoading(true);
    try {
      const result = await userApi.signInWithGoogle();

      if (result) {
        setWelcomeMessage("구글 로그인 성공! 잠시 후 이동합니다...");
      }
    } catch (error) {
      console.error("Google login error:", error);
    } finally {
      setIsGoogleLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 flex items-center justify-center p-4">
      {/* 배경 장식 요소 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-orange-200/30 to-amber-200/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-yellow-200/30 to-orange-200/30 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* 환영 메시지 */}
        {welcomeMessage && (
          <div className="mb-4 p-4 bg-green-100 border border-green-200 rounded-2xl text-center">
            <p className="text-green-700 font-medium">{welcomeMessage}</p>
          </div>
        )}

        {/* 메인 카드 */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/20 p-8 animate-fade-in">
          {/* 헤더 섹션 */}
          <div className="text-center mb-8">
            {/* 로고 */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-r from-orange-400 to-amber-400 flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform duration-300">
                <img
                  src="/hodam.png"
                  className="w-12 h-12 filter brightness-0 invert"
                  alt="호담 로고"
                />
              </div>
            </div>

            {/* 제목 */}
            <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent mb-2">
              호담에 오신 것을 환영합니다
            </h1>
            <p className="text-gray-600 text-lg">
              AI와 함께 만드는 나만의 동화
            </p>
          </div>

          {/* 로그인 버튼들 */}
          <div className="space-y-4">
            {/* 카카오 로그인 */}
            <button
              onClick={signinWithKakao}
              disabled={isKakaoLoading || isGoogleLoading}
              className="w-full group relative overflow-hidden bg-[#FEE500] hover:bg-[#FFEB3B] disabled:bg-gray-300 disabled:cursor-not-allowed rounded-2xl px-6 py-4 transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg disabled:transform-none disabled:shadow-none"
            >
              <div className="flex items-center justify-center relative z-10">
                {isKakaoLoading ? (
                  <div className="w-6 h-6 border-2 border-[#3C1E1E] border-t-transparent rounded-full animate-spin mr-3" />
                ) : (
                  <img
                    src="https://zdvnlojkptjgalxgcqxa.supabase.co/storage/v1/object/sign/dev_src/kakao_logo.svg?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1cmwiOiJkZXZfc3JjL2tha2FvX2xvZ28uc3ZnIiwiaWF0IjoxNzI3NTA1ODM3LCJleHAiOjIwNDI4NjU4Mzd9.Cmokqsi-zX2BRPMbFK68LihtknghrBnZSfTrg-K8a0o&t=2024-09-28T06%3A43%3A57.830Z"
                    alt="카카오 로그인"
                    className="h-6 mr-3"
                  />
                )}
                <span className="text-[#3C1E1E] font-semibold text-lg">
                  {isKakaoLoading ? "로그인 중..." : "카카오로 시작하기"}
                </span>
              </div>
              {/* 호버 효과 */}
              {!isKakaoLoading && !isGoogleLoading && (
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-300/0 via-yellow-300/20 to-yellow-300/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              )}
            </button>

            {/* 구글 로그인 */}
            <button
              onClick={signinWithGoogle}
              disabled={isKakaoLoading || isGoogleLoading}
              className="w-full group relative overflow-hidden bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed border-2 border-gray-200 hover:border-gray-300 disabled:border-gray-200 rounded-2xl px-6 py-4 transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg disabled:transform-none disabled:shadow-none"
            >
              <div className="flex items-center justify-center relative z-10">
                {isGoogleLoading ? (
                  <div className="w-6 h-6 border-2 border-gray-600 border-t-transparent rounded-full animate-spin mr-3" />
                ) : (
                  <img
                    src="https://zdvnlojkptjgalxgcqxa.supabase.co/storage/v1/object/sign/dev_src/google_logo.svg?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1cmwiOiJkZXZfc3JjL2dvb2dsZV9sb2dvLnN2ZyIsImlhdCI6MTcyNzUwNTgyNCwiZXhwIjoyMDQyODY1ODI0fQ.DzYbBmaD4t6MHGlJQCYx-vpXvpKCoMlA7usHb-OsSRI&t=2024-09-28T06%3A43%3A44.619Z"
                    alt="구글 로그인"
                    className="h-6 mr-3"
                  />
                )}
                <span className="text-gray-700 font-semibold text-lg">
                  {isGoogleLoading ? "로그인 중..." : "Google로 시작하기"}
                </span>
              </div>
              {/* 호버 효과 */}
              {!isKakaoLoading && !isGoogleLoading && (
                <div className="absolute inset-0 bg-gradient-to-r from-gray-100/0 via-gray-100/50 to-gray-100/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              )}
            </button>
          </div>

          {/* 하단 정보 */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500 leading-relaxed">
              로그인하시면{" "}
              <a
                href="/terms"
                className="text-orange-600 hover:text-orange-700 underline"
              >
                이용약관
              </a>
              과{" "}
              <a
                href="/privacy"
                className="text-orange-600 hover:text-orange-700 underline"
              >
                개인정보처리방침
              </a>
              에 동의하는 것으로 간주됩니다.
            </p>
          </div>
        </div>

        {/* 하단 장식 */}
        <div className="text-center mt-6">
          <div className="inline-flex items-center space-x-2 text-gray-400">
            <div className="w-2 h-2 bg-orange-300 rounded-full animate-pulse" />
            <span className="text-sm">AI 동화 생성의 새로운 경험</span>
            <div className="w-2 h-2 bg-amber-300 rounded-full animate-pulse delay-300" />
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }
      `}</style>
    </div>
  );
}
