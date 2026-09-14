"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="auth-page" role="alert">
      <h1>
        잠시 페이지를
        <br />
        열지 못했어요.
      </h1>
      <p>
        연결 상태를 확인하고 다시 시도해주세요. 저장된 그림책은 내 책장에서
        확인할 수 있어요.
      </p>
      <button type="button" onClick={reset} className="button-primary">
        다시 시도하기
      </button>
      <Link href="/my-story" className="text-link block mt-5">
        내 책장으로 가기
      </Link>
    </div>
  );
}
