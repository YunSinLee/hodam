import Image from "next/image";
import Link from "next/link";

export default function MiniFooter() {
  return (
    <footer className="border-t border-[#ef8d3d]/15 bg-[#fffaf2] py-5">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-[#ef8d3d] to-[#f2b250]">
              <Image
                src="/hodam.png"
                className="h-5 w-5 brightness-0 invert"
                alt="호담 로고"
                width={20}
                height={20}
              />
            </div>
            <p className="hodam-heading text-lg text-[#a45b1c]">HODAM</p>
          </div>

          <div className="flex flex-wrap gap-3 text-sm text-[#5f6670]">
            <Link href="/terms" className="transition hover:text-[#b45f1c]">
              이용약관
            </Link>
            <Link href="/privacy" className="transition hover:text-[#b45f1c]">
              개인정보처리방침
            </Link>
            <a
              href="mailto:dldbstls7777@naver.com"
              className="transition hover:text-[#b45f1c]"
            >
              문의하기
            </a>
          </div>

          <div className="text-xs text-[#7b7f86]">
            © 2026 HODAM. Beta Service
          </div>
        </div>
      </div>
    </footer>
  );
}
