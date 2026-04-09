import Link from "next/link";

export default function HodamRoutePage() {
  return (
    <div className="hodam-page-shell min-h-screen px-4 pb-16 pt-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <section className="hodam-glass-card p-7 text-center sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#ad6220]">
            Hodam
          </p>
          <h1 className="hodam-heading mt-3 text-4xl text-[#2f3338] sm:text-5xl">
            동화 만들기 허브
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-[#5f6670] sm:text-base">
            키워드 입력부터 분기형 스토리 생성, 번역/이미지 옵션까지 한 번에
            시작할 수 있습니다.
          </p>

          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/service"
              className="hodam-primary-button text-sm sm:text-base"
            >
              동화 만들기 시작
              <span aria-hidden>→</span>
            </Link>
            <Link
              href="/"
              className="hodam-outline-button text-sm sm:text-base"
            >
              홈으로 돌아가기
            </Link>
          </div>

          <div className="mt-6 rounded-2xl border border-[#ef8d3d]/18 bg-[#fff8ef] px-4 py-3 text-xs text-[#8e5a28] sm:text-sm">
            기존 북마크로 `/hodam`에 접속하신 경우, 이제 이 화면에서 바로
            서비스로 진입할 수 있습니다.
          </div>
        </section>
      </div>
    </div>
  );
}
