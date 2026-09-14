import Link from "next/link";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-top">
          <Link href="/" className="wordmark" aria-label="호담 홈">
            <span>호담</span>
            <small>오늘을 담은 그림책</small>
          </Link>
          <nav aria-label="서비스 정보">
            <Link href="/terms">이용약관</Link>
            <Link href="/privacy">개인정보처리방침</Link>
            <a href="mailto:dldbstls7777@naver.com">문의하기</a>
          </nav>
        </div>
        <p>
          대표 이윤신 · 사업자등록번호 171-55-00898 · 개인정보보호책임자 이윤신
          <br />
          인천광역시 부평구 장제로 162, 308호 · dldbstls7777@naver.com
        </p>
        <p className="mt-4">
          © {new Date().getFullYear()} HODAM · 베타 서비스 운영 중
        </p>
      </div>
    </footer>
  );
}
