import Link from "next/link";

export default function GuideForSign() {
  return (
    <section className="hodam-page-shell min-h-[65vh] px-2 py-4 sm:py-6">
      <div className="mx-auto max-w-3xl rounded-[30px] border border-[#ef8d3d]/20 bg-white/90 p-6 shadow-[0_24px_48px_rgba(181,94,23,0.12)] backdrop-blur-sm sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#ef8d3d]/25 bg-[#fff8ee] px-3 py-1 text-xs font-semibold text-[#a85b18]">
              Access Required
            </div>
            <h2 className="hodam-heading text-3xl leading-tight text-[#2f3033] sm:text-4xl">
              동화 생성을 시작하려면
              <br />
              로그인해주세요
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-[#6b7280] sm:text-base">
              로그인 후 키워드 입력, 분기 선택, 영어 번역, 이미지 생성 기능을
              바로 사용할 수 있습니다.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="hodam-chip">카카오 로그인</span>
              <span className="hodam-chip">Google 로그인</span>
              <span className="hodam-chip">1분 내 시작</span>
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/sign-in"
                className="hodam-primary-button text-sm sm:text-base"
              >
                로그인하고 시작하기
              </Link>
              <Link
                href="/"
                className="hodam-outline-button text-sm sm:text-base"
              >
                홈에서 서비스 보기
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-[#ef8d3d]/20 bg-[#fff8ef] p-5">
            <p className="text-xs font-bold uppercase tracking-[0.11em] text-[#a85b18]">
              로그인 후 가능 기능
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[#4b5563]">
              <li>• 키워드 기반 동화 즉시 생성</li>
              <li>• 스토리 분기 선택으로 전개 확장</li>
              <li>• 영어 번역 및 일러스트 생성</li>
              <li>• 내 동화 저장 및 다시보기</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
