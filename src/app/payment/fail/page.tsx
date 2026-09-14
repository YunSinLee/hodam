import Link from "next/link";

export default function PaymentFail() {
  return (
    <div className="auth-page">
      <h1>충전을 마치지 못했어요.</h1>
      <p>
        결제가 취소되었거나 승인이 완료되지 않았어요. 실제 결제 여부는 결제
        내역에서 확인해주세요.
      </p>
      <Link href="/bead" className="button-primary">
        곶감 페이지로
      </Link>
      <Link className="text-link block mt-5" href="/payment-history">
        결제 내역 확인
      </Link>
    </div>
  );
}
