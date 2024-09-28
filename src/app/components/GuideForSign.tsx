import Link from "next/link";
import HButton from "@/app/components//atomic/HButton";

export default function GuideForSign() {
  return (
    <div className="text-center">
      <p>로그인이 필요합니다.</p>
      <div className="flex justify-center mt-4">
        <Link href="/sign-in">
          <HButton label="로그인" />
        </Link>
      </div>
    </div>
  );
}
