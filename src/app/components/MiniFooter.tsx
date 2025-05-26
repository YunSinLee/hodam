import Link from "next/link";

export default function MiniFooter() {
  return (
    <footer className="bg-gray-50 border-t border-gray-200 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          {/* 로고 및 기본 정보 */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-orange-400 to-amber-400 flex items-center justify-center">
              <img
                src="/hodam.png"
                className="w-5 h-5 filter brightness-0 invert"
                alt="호담 로고"
              />
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
              HODAM
            </span>
          </div>

          {/* 법적 링크 */}
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <Link
              href="/terms"
              className="text-gray-600 hover:text-orange-600 transition-colors"
            >
              이용약관
            </Link>
            <Link
              href="/privacy"
              className="text-gray-600 hover:text-orange-600 transition-colors"
            >
              개인정보처리방침
            </Link>
            <a
              href="mailto:dldbstls7777@naver.com"
              className="text-gray-600 hover:text-orange-600 transition-colors"
            >
              문의하기
            </a>
          </div>

          {/* 사업자 정보 */}
          <div className="text-xs text-gray-500 text-center md:text-right">
            <div>사업자등록번호: 171-55-00898</div>
            <div>대표자: 이윤신 | 이메일: dldbstls7777@naver.com</div>
          </div>
        </div>

        {/* 저작권 */}
        <div className="mt-4 pt-4 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-500">
            © 2024 HODAM. All rights reserved. | 베타 서비스 운영 중
          </p>
        </div>
      </div>
    </footer>
  );
}
