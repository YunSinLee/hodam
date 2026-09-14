"use client";

import { useEffect, useState } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import useUserInfo from "@/services/hooks/use-user-info";

export default function GuideForSign() {
  const pathname = usePathname();
  const [returnPath, setReturnPath] = useState(pathname);
  useEffect(() => {
    setReturnPath(`${pathname}${window.location.search}`);
  }, [pathname]);
  const { isAuthReady } = useUserInfo();
  const isPayment = pathname.startsWith("/payment") || pathname === "/bead";
  const isAccount = pathname === "/profile";
  if (!isAuthReady)
    return (
      <div className="empty-state" role="status">
        로그인 정보를 확인하고 있어요.
      </div>
    );
  return (
    <div className="auth-page">
      <p className="eyebrow">
        {isPayment ? "나의 곶감과 결제" : "나만의 책장"}
      </p>
      <h1>
        {isPayment
          ? "결제 정보를 확인하려면"
          : isAccount
            ? "계정 정보를 보려면"
            : "이야기를 꺼내려면"}
        <br />
        로그인해주세요.
      </h1>
      <p>
        {isPayment
          ? "결제와 곶감은 로그인한 계정에 연결돼요."
          : "만든 그림책은 로그인한 계정에 보관돼요."}
        <br />
        로그인 후 이 화면으로 돌아올게요.
      </p>
      <Link
        className="button-primary w-full"
        href={`/sign-in?next=${encodeURIComponent(returnPath)}`}
      >
        로그인하고 계속하기
      </Link>
      <Link className="text-link inline-block mt-6" href="/sample">
        그림책 미리 읽어보기 →
      </Link>
    </div>
  );
}
