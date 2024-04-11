"use client";

import React, { useState } from "react";
import userApi from "@/app/api/user";
import HButton from "@/app/components/atomic/HButton";

export default function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  // const [phone, setPhone] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  // const [phoneError, setPhoneError] = useState("");

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
    setConfirmPasswordError(
      value === confirmPassword ? "" : "비밀번호가 일치하지 않습니다.",
    );
  };

  const handleConfirmPasswordChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = e.target.value;
    setConfirmPassword(value);
    setConfirmPasswordError(
      value === password ? "" : "비밀번호가 일치하지 않습니다.",
    );
  };

  // const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const value = e.target.value;
  //   setPhone(value);
  //   setPhoneError(
  //     validationPhone(value)
  //       ? ""
  //       : "휴대폰 번호가 올바르지 않습니다.(예: 010-1234-5678)",
  //   );
  // };

  // const validationPhone = (phone: string) => {
  //   const phoneRegex = /^\d{3}-\d{3,4}-\d{4}$/;
  //   return phoneRegex.test(phone);
  // };

  // const formatPhoneNumber = (phone: string) => {
  //   const formattedPhone = phone.replace(/-/g, "");
  //   return `+82${formattedPhone}`;
  // };

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
    if (password !== confirmPassword) {
      setConfirmPasswordError("비밀번호가 일치하지 않습니다.");
      return;
    }
    // if (!phone && phone.length !== 13) {
    //   setPhoneError("휴대폰 번호가 올바르지 않습니다.(예: 010-1234-5678)");
    //   return;
    // }
    // const formattedPhone = formatPhoneNumber(phone);

    const { data, error } = await userApi.signUp({
      email,
      password,
      // phone: formattedPhone,
    });

    if (error) {
      alert(
        `ErrorCode: ${error.status}\nErrorMessage: ${error.message}\n
        회원가입에 실패했습니다. 반복될 경우, dldbstls7777@naver.com으로 문의주세요.`,
      );
    } else {
      alert("회원가입에 성공했습니다.");
      location.href = "/sign-in";
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
  const buttonDisabled =
    !email || !password || !confirmPassword || password !== confirmPassword;

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col max-w-md mx-auto mt-20"
    >
      <label className="mb-2 flex gap-4 items-center">
        <span className="block w-24">이메일</span>
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
        <span className="block w-24">비밀번호</span>
        <input
          type="password"
          value={password}
          onChange={handlePasswordChange}
          className="border border-gray-300 rounded-md px-2 py-1 mt-1 flex-1"
        />
      </label>
      {passwordError && <p className="text-red-500">{passwordError}</p>}
      <br />
      <label className="mb-2 flex gap-4 items-center">
        <span className="block w-24">비밀번호 확인</span>
        <input
          type="password"
          value={confirmPassword}
          onChange={handleConfirmPasswordChange}
          className="border border-gray-300 rounded-md px-2 py-1 mt-1 flex-1"
        />
      </label>
      {confirmPasswordError && (
        <p className="text-red-500">{confirmPasswordError}</p>
      )}
      <br />
      {/* <label className="mb-2 flex gap-4 items-center">
        <span className="block w-24">휴대폰 번호</span>
        <input
          type="text"
          value={phone}
          onChange={handlePhoneChange}
          className="border border-gray-300 rounded-md px-2 py-1 mt-1 flex-1"
        />
      </label>
      {phoneError && <p className="text-red-500">{phoneError}</p>}
      <br /> */}

      <HButton
        label="회원가입"
        size="md"
        style="filled"
        className="text-center"
        disabled={buttonDisabled}
      />
    </form>
  );
}
