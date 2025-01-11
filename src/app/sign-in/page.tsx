"use client";

import React from "react"; // useState 제거
import userApi from "@/app/api/user";
// import useUserInfo from "@/services/hooks/use-user-info";

export default function SignIn() {
  async function signinWithKakao() {
    await userApi.signInWithKakao();
  }

  async function signinWithGoogle() {
    await userApi.signInWithGoogle();
  }

  return (
    <div className="flex flex-col items-center mt-20">
      <button
        type="button"
        onClick={signinWithKakao}
        className="mb-4 flex items-center justify-center bg-yellow-400 rounded-md px-4 py-3 hover:bg-yellow-500 transition w-full max-w-xs"
      >
        <img
          src="https://zdvnlojkptjgalxgcqxa.supabase.co/storage/v1/object/sign/dev_src/kakao_logo.svg?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1cmwiOiJkZXZfc3JjL2tha2FvX2xvZ28uc3ZnIiwiaWF0IjoxNzI3NTA1ODM3LCJleHAiOjIwNDI4NjU4Mzd9.Cmokqsi-zX2BRPMbFK68LihtknghrBnZSfTrg-K8a0o&t=2024-09-28T06%3A43%3A57.830Z"
          alt="카카오 로그인"
          className="h-6 mr-2"
        />
        카카오로 로그인
      </button>
      <button
        type="button"
        onClick={signinWithGoogle}
        className="flex items-center justify-center bg-white border border-gray-300 rounded-md px-4 py-3 hover:bg-gray-100 transition w-full max-w-xs"
      >
        <img
          src="https://zdvnlojkptjgalxgcqxa.supabase.co/storage/v1/object/sign/dev_src/google_logo.svg?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1cmwiOiJkZXZfc3JjL2dvb2dsZV9sb2dvLnN2ZyIsImlhdCI6MTcyNzUwNTgyNCwiZXhwIjoyMDQyODY1ODI0fQ.DzYbBmaD4t6MHGlJQCYx-vpXvpKCoMlA7usHb-OsSRI&t=2024-09-28T06%3A43%3A44.619Z"
          alt="구글 로그인"
          className="h-6 mr-2"
        />
        구글로 로그인
      </button>
    </div>
  );
}
