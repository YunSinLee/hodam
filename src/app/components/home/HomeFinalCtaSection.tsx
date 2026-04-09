import Link from "next/link";

export default function HomeFinalCtaSection() {
  return (
    <section className="bg-gradient-to-r from-orange-500 to-amber-500 py-14 sm:py-20">
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="mb-4 text-2xl font-bold text-white sm:mb-6 sm:text-4xl">
          지금 바로 나만의 동화를 만들어보세요!
        </h2>
        <p className="mx-auto mb-7 max-w-2xl text-base text-orange-100 sm:mb-8 sm:text-xl">
          키워드 몇 개로 시작하는 특별한 이야기 여행
        </p>

        <Link href="/service" className="group inline-block w-full sm:w-auto">
          <div className="rounded-full bg-white px-8 py-4 text-base font-bold text-orange-600 shadow-lg transition-all duration-300 group-hover:scale-105 group-hover:bg-orange-50 group-hover:shadow-xl sm:text-lg">
            <span className="flex items-center gap-2">
              동화 만들기 시작
              <svg
                className="h-5 w-5 transition-transform group-hover:translate-x-1"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
          </div>
        </Link>
      </div>
    </section>
  );
}
