import Link from "next/link";

export default function MyStoryEmptyState() {
  return (
    <section className="rounded-xl border border-orange-100 bg-gradient-to-b from-orange-50 to-white px-4 py-12 text-center shadow-sm transition-all duration-300 hover:shadow-md sm:px-6 sm:py-14">
      <div className="mb-6 flex justify-center">
        <div className="relative h-24 w-24 sm:h-28 sm:w-28">
          <div
            className="absolute inset-0 animate-ping rounded-full bg-orange-100 opacity-50"
            style={{ animationDuration: "3s" }}
          />
          <div className="relative flex h-full w-full items-center justify-center rounded-full bg-orange-50">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-14 w-14 text-orange-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
          </div>
        </div>
      </div>
      <h2 className="mb-3 text-xl font-semibold text-gray-700 sm:text-2xl">
        아직 만든 동화가 없어요
      </h2>
      <p className="mx-auto mb-8 max-w-md text-sm text-gray-600 sm:text-base">
        새로운 동화를 만들어 호담과 함께 창의적인 이야기를 만들어보세요!
      </p>
      <Link
        href="/service"
        className="inline-flex items-center rounded-full bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-3 text-white shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:from-orange-600 hover:to-orange-700 hover:shadow-lg"
      >
        <span className="font-medium">새 동화 만들기</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="ml-2 h-5 w-5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </Link>
    </section>
  );
}
