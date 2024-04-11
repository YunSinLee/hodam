"use client";

import React, { useState } from "react";
import userApi from "@/app/api/user";
import useUserInfo from "@/services/hooks/use-user-info";

import HButton from "@/app/components/atomic/HButton";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const { setUserInfo } = useUserInfo();

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    setEmailError(validateEmail(value) ? "" : "이메일이 올바르지 않습니다.");
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    setPasswordError(
      validatePassword(value)
        ? ""
        : "비밀번호는 8자 이상이어야 하며 문자와 숫자, 특수기호의 조합이어야 합니다.",
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEmail(email)) {
      setEmailError("이메일이 올바르지 않습니다.");
      return;
    }
    if (!validatePassword(password)) {
      setPasswordError(
        "비밀번호는 8자 이상이어야 하며 문자와 숫자, 특수기호의 조합이어야 합니다.",
      );
      return;
    }

    const data = await userApi.signIn({ email, password });

    if (data) {
      setUserInfo(data);
      location.href = "/";
    }
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string) => {
    const passwordRegex =
      /^(?:(?=.*[A-Za-z])(?=.*\d)|(?=.*[A-Za-z])(?=.*[@$!%*#?&])|(?=.*\d)(?=.*[@$!%*#?&]))[A-Za-z\d@$!%*#?&]{8,}$/;
    return passwordRegex.test(password);
  };

  const buttonDisabled = !email || !password;

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col max-w-96 mx-auto mt-20"
    >
      <label className="mb-2 flex gap-4 items-center">
        <span className="block w-14">이메일</span>
        <input
          type="email"
          value={email}
          onChange={handleEmailChange}
          className="border border-gray-300 rounded-md px-2 py-1 mt-1 flex-1"
        />
      </label>
      {emailError && <p className="text-red-500">{emailError}</p>}
      <br />
      <label className="mb-2 flex gap-4 items-center">
        <span className="block w-14">비밀번호</span>
        <input
          type="password"
          value={password}
          onChange={handlePasswordChange}
          className="border border-gray-300 rounded-md px-2 py-1 mt-1 flex-1"
        />
      </label>
      {passwordError && <p className="text-red-500">{passwordError}</p>}
      <br />
      <HButton
        label="로그인"
        size="md"
        style="filled"
        className="text-center"
        disabled={buttonDisabled}
      />
    </form>
  );
}
