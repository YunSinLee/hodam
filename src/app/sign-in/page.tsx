"use client";

import React, { useState } from "react";
import userApi from "../api/user";
import useUserInfo from "@/services/hooks/use-user-info";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const { setUserInfo } = useUserInfo();

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    setEmailError(
      validateEmail(value) ? "" : "Please enter a valid email address.",
    );
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    setPasswordError(
      validatePassword(value)
        ? ""
        : "Password must be at least 8 characters long and contain a combination of letters and numbers.",
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEmail(email)) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    if (!validatePassword(password)) {
      setPasswordError(
        "Password must be at least 8 characters long and contain a combination of letters and numbers.",
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
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
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
      <button
        type="submit"
        disabled={buttonDisabled}
        className="bg-orange-500 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded"
      >
        로그인
      </button>
    </form>
  );
}
