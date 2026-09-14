export default function HomeInfoSection() {
  return (
    <section className="bg-gradient-to-r from-orange-50 to-amber-50 py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-white p-6 shadow-xl sm:p-12">
          <div className="mb-8 text-center">
            <h2 className="mb-3 text-2xl font-bold text-gray-900 sm:mb-4 sm:text-4xl">
              이용 안내
            </h2>
            <p className="text-base text-gray-600 sm:text-lg">
              호담을 더 잘 활용하기 위한 안내사항입니다
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
            <article className="rounded-2xl border border-blue-100 bg-blue-50 p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500">
                  <svg
                    className="h-5 w-5 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-blue-900">
                  베타 서비스
                </h3>
              </div>
              <p className="text-blue-800">
                현재 베타 버전으로 운영 중입니다. 회원가입 시 제공되는
                곶감으로만 이용 가능하며, 정식 출시 시 데이터가 초기화될 수
                있습니다.
              </p>
            </article>

            <article className="rounded-2xl border border-yellow-100 bg-yellow-50 p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-500">
                  <svg
                    className="h-5 w-5 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-yellow-900">
                  처리 시간
                </h3>
              </div>
              <p className="text-yellow-800">
                AI가 동화를 생성하는 데 약 30초 이상 소요됩니다. 고품질의
                결과물을 위해 조금만 기다려주세요.
              </p>
            </article>

            <article className="rounded-2xl border border-green-100 bg-green-50 p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500">
                  <svg
                    className="h-5 w-5 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-green-900">
                  문의 및 제안
                </h3>
              </div>
              <p className="mb-3 text-green-800">
                서비스 개선을 위한 소중한 의견을 기다립니다.
              </p>
              <a
                href="mailto:dldbstls7777@naver.com"
                className="inline-flex items-center gap-2 font-medium text-green-700 transition-colors hover:text-green-800"
              >
                <span>dldbstls7777@naver.com</span>
                <svg
                  className="h-4 w-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </a>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}
