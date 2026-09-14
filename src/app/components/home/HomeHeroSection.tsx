import Link from "next/link";

export default function HomeHeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-orange-400/10 to-amber-400/10" />
      <div className="relative mx-auto max-w-7xl px-4 pb-14 pt-12 sm:px-6 sm:pb-20 sm:pt-16 lg:px-8">
        <div className="text-center">
          <div className="mb-6 animate-bounce sm:mb-8">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-orange-400 to-amber-400 shadow-lg sm:h-20 sm:w-20">
              <span className="text-2xl sm:text-3xl">📚</span>
            </div>
          </div>

          <h1 className="mb-4 text-3xl font-bold leading-tight text-gray-900 sm:mb-6 sm:text-5xl lg:text-6xl">
            <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
              호담
            </span>
            <br />
            <span className="text-xl font-medium text-gray-700 sm:text-3xl lg:text-4xl">
              AI가 만드는 나만의 동화
            </span>
          </h1>

          <p className="mx-auto mb-6 max-w-3xl text-base leading-relaxed text-gray-600 sm:mb-8 sm:text-xl">
            키워드 몇 개만 입력하면 AI가 특별한 동화를 만들어드립니다.
            <br />
            상상력이 현실이 되는 마법 같은 경험을 시작해보세요.
          </p>

          <div className="mb-10 sm:mb-12">
            <div className="inline-flex max-w-full flex-wrap items-center justify-center gap-2 rounded-2xl border border-orange-100 bg-white px-4 py-3 text-sm shadow-lg sm:rounded-full sm:px-6 sm:text-base">
              <span className="text-gray-600">예시:</span>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700 sm:text-sm">
                  철수
                </span>
                <span className="text-gray-400">+</span>
                <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700 sm:text-sm">
                  호랑이
                </span>
                <span className="text-gray-400">+</span>
                <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700 sm:text-sm">
                  사과
                </span>
              </div>
              <span className="text-gray-400">→</span>
              <span className="font-medium text-orange-600">동화 완성!</span>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Link href="/service" className="group w-full sm:w-auto">
              <div className="relative w-full overflow-hidden rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-8 py-4 text-base font-semibold text-white shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl sm:text-lg">
                <div className="absolute inset-0 bg-gradient-to-r from-orange-600 to-amber-600 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <span className="relative flex items-center justify-center gap-2">
                  지금 시작하기
                </span>
              </div>
            </Link>

            <div className="flex items-center gap-2 text-xs text-gray-500 sm:text-sm">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              무료 체험 가능
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
