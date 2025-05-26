import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-gray-50 border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* 회사 정보 */}
          <div className="lg:col-span-2">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-orange-400 to-amber-400 flex items-center justify-center">
                <img
                  src="/hodam.png"
                  className="w-6 h-6 filter brightness-0 invert"
                  alt="호담 로고"
                />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
                HODAM
              </span>
            </div>
            <p className="text-gray-600 mb-4 max-w-md">
              AI 기술로 만드는 개인 맞춤형 동화 서비스
            </p>

            {/* 사업자 정보 */}
            <div className="space-y-2 text-sm text-gray-500">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <span className="font-medium">대표자:</span> 이윤신
                </div>
                <div>
                  <span className="font-medium">사업자등록번호:</span>{" "}
                  171-55-00898
                </div>
                <div>
                  <span className="font-medium">통신판매업신고:</span> [신고
                  예정]
                </div>
                <div>
                  <span className="font-medium">개인정보보호책임자:</span>{" "}
                  이윤신
                </div>
              </div>
              <div className="pt-2">
                <div className="mb-1">
                  <span className="font-medium">주소:</span> 인천광역시 부평구
                  장제로 162, 308호
                </div>
                <div className="flex flex-col sm:flex-row sm:gap-4">
                  <div>
                    <span className="font-medium">전화:</span> [연락처 추가
                    예정]
                  </div>
                  <div>
                    <span className="font-medium">이메일:</span>{" "}
                    dldbstls7777@naver.com
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 서비스 링크 */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
              서비스
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/service"
                  className="text-gray-600 hover:text-orange-600 transition-colors"
                >
                  동화 만들기
                </Link>
              </li>
              <li>
                <Link
                  href="/my-story"
                  className="text-gray-600 hover:text-orange-600 transition-colors"
                >
                  내 동화
                </Link>
              </li>
              <li>
                <Link
                  href="/bead"
                  className="text-gray-600 hover:text-orange-600 transition-colors"
                >
                  곶감 충전
                </Link>
              </li>
            </ul>
          </div>

          {/* 법적 정보 */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
              법적 정보
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/terms"
                  className="text-gray-600 hover:text-orange-600 transition-colors"
                >
                  이용약관
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-gray-600 hover:text-orange-600 transition-colors"
                >
                  개인정보처리방침
                </Link>
              </li>
              <li>
                <a
                  href="mailto:dldbstls7777@naver.com"
                  className="text-gray-600 hover:text-orange-600 transition-colors"
                >
                  문의하기
                </a>
              </li>
              <li>
                <a
                  href="https://forms.gle/zKVVo9VKtsDyZGXy8"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 hover:text-orange-600 transition-colors"
                >
                  피드백
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* 하단 구분선 및 저작권 */}
        <div className="mt-8 pt-8 border-t border-gray-200">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-sm text-gray-500 mb-4 md:mb-0">
              <p>© 2024 HODAM. All rights reserved.</p>
              <p className="mt-1">
                현재 베타 서비스로 운영 중이며, 정식 출시 시 데이터가 초기화될
                수 있습니다.
              </p>
            </div>

            {/* 소셜 미디어 또는 추가 링크 */}
            <div className="flex space-x-4">
              <a
                href="mailto:dldbstls7777@naver.com"
                className="text-gray-400 hover:text-orange-500 transition-colors"
                aria-label="이메일 문의"
              >
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        {/* 추가 법적 고지사항 */}
        <div className="mt-6 pt-6 border-t border-gray-100">
          <div className="text-xs text-gray-400 space-y-1">
            <p>
              • 호담은 AI 기술을 활용한 동화 생성 서비스로, 생성된 콘텐츠의
              품질이나 적절성에 대해 완전한 보장을 하지 않습니다.
            </p>
            <p>
              • 서비스 이용 중 문제가 발생할 경우 고객센터로 연락주시기
              바랍니다.
            </p>
            <p>• 미성년자의 서비스 이용 시 법정대리인의 동의가 필요합니다.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
