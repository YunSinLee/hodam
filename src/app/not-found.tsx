import Link from "next/link";

export default function NotFound() {
  return (
    <div className="auth-page">
      <p className="eyebrow">찾을 수 없는 페이지</p>
      <h1>
        이 페이지는
        <br />
        책장에 없네요.
      </h1>
      <p>주소가 바뀌었거나 더 이상 열 수 없는 페이지예요.</p>
      <Link className="button-primary" href="/">
        호담 홈으로
      </Link>
      <Link className="text-link block mt-5" href="/my-story">
        내 책장으로 가기
      </Link>
    </div>
  );
}
