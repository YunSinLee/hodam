import Link from "next/link";

export default function GuideForSign() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="relative">
        {/* 배경 장식 */}
        <div className="absolute inset-0 -m-8 bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 rounded-3xl blur-sm" />

        {/* 메인 카드 */}
        <div className="relative bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-orange-100 p-8 max-w-md mx-auto text-center">
          {/* 아이콘 */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-orange-400 to-amber-400 flex items-center justify-center shadow-lg">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
          </div>

          {/* 제목 */}
          <h2 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent mb-3">
            로그인이 필요합니다
          </h2>

          {/* 설명 */}
          <p className="text-gray-600 mb-6 leading-relaxed">
            호담의 모든 기능을 이용하려면
            <br />
            로그인해 주세요
          </p>

          {/* 로그인 버튼 */}
          <Link href="/sign-in">
            <button className="w-full group relative overflow-hidden bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold py-4 px-6 rounded-2xl transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg">
              <span className="relative z-10 flex items-center justify-center">
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                  />
                </svg>
                로그인하기
              </span>
              {/* 호버 효과 */}
              <div className="absolute inset-0 bg-gradient-to-r from-orange-400/0 via-orange-400/20 to-orange-400/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            </button>
          </Link>

          {/* 하단 정보 */}
          <div className="mt-6">
            <p className="text-sm text-gray-500">
              카카오 또는 Google 계정으로
              <br />
              간편하게 시작하세요
            </p>
          </div>
        </div>

        {/* 장식 요소 */}
        <div className="absolute -top-4 -right-4 w-8 h-8 bg-orange-200 rounded-full opacity-60 animate-pulse" />
        <div className="absolute -bottom-4 -left-4 w-6 h-6 bg-amber-200 rounded-full opacity-60 animate-pulse delay-300" />
      </div>
    </div>
  );
}
