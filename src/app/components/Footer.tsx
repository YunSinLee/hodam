import Image from "next/image";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-[#ef8d3d]/20 bg-gradient-to-b from-[#fff9ef] to-[#fffef8]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr_0.75fr]">
          <section>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-[#ef8d3d] to-[#f2b250]">
                <Image
                  src="/hodam.png"
                  className="h-6 w-6 brightness-0 invert"
                  alt="호담 로고"
                  width={24}
                  height={24}
                />
              </div>
              <div>
                <p className="hodam-heading text-2xl text-[#aa5e1c]">HODAM</p>
                <p className="text-xs text-[#7b7f86]">내가 만드는 AI 동화</p>
              </div>
            </div>

            <p className="mt-4 max-w-xl text-sm leading-relaxed text-[#5f6670]">
              호담은 키워드를 기반으로 개인 맞춤형 동화를 생성하는 서비스입니다.
              아이와 함께 읽는 취침 동화, 수업 도입 이야기, 영어 노출 콘텐츠를
              빠르게 만들 수 있습니다.
            </p>

            <div className="mt-6 rounded-2xl border border-[#ef8d3d]/20 bg-white/80 p-4 text-sm text-[#5f6670]">
              <p>
                <span className="font-semibold text-[#3f434a]">대표자</span>{" "}
                이윤신
              </p>
              <p className="mt-1">
                <span className="font-semibold text-[#3f434a]">
                  사업자등록번호
                </span>{" "}
                171-55-00898
              </p>
              <p className="mt-1">
                <span className="font-semibold text-[#3f434a]">주소</span>{" "}
                인천광역시 부평구 장제로 162, 308호
              </p>
              <p className="mt-1">
                <span className="font-semibold text-[#3f434a]">이메일</span>{" "}
                dldbstls7777@naver.com
              </p>
              <p className="mt-1">
                <span className="font-semibold text-[#3f434a]">
                  통신판매업신고
                </span>{" "}
                신고 예정
              </p>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-bold uppercase tracking-[0.1em] text-[#a05a1a]">
              서비스
            </h3>
            <ul className="mt-4 space-y-2 text-sm text-[#5f6670]">
              <li>
                <Link
                  href="/service"
                  className="transition hover:text-[#b45f1c]"
                >
                  동화 만들기
                </Link>
              </li>
              <li>
                <Link
                  href="/my-story"
                  className="transition hover:text-[#b45f1c]"
                >
                  내 동화
                </Link>
              </li>
              <li>
                <Link href="/bead" className="transition hover:text-[#b45f1c]">
                  곶감 충전
                </Link>
              </li>
              <li>
                <Link
                  href="/profile"
                  className="transition hover:text-[#b45f1c]"
                >
                  프로필
                </Link>
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-sm font-bold uppercase tracking-[0.1em] text-[#a05a1a]">
              정책/문의
            </h3>
            <ul className="mt-4 space-y-2 text-sm text-[#5f6670]">
              <li>
                <Link href="/terms" className="transition hover:text-[#b45f1c]">
                  이용약관
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="transition hover:text-[#b45f1c]"
                >
                  개인정보처리방침
                </Link>
              </li>
              <li>
                <a
                  href="mailto:dldbstls7777@naver.com"
                  className="transition hover:text-[#b45f1c]"
                >
                  이메일 문의
                </a>
              </li>
              <li>
                <a
                  href="https://forms.gle/zKVVo9VKtsDyZGXy8"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition hover:text-[#b45f1c]"
                >
                  피드백 전달
                </a>
              </li>
            </ul>
          </section>
        </div>

        <div className="mt-8 border-t border-[#ef8d3d]/15 pt-5">
          <div className="flex flex-col gap-2 text-xs text-[#7b7f86] sm:flex-row sm:items-center sm:justify-between">
            <p>© 2026 HODAM. All rights reserved.</p>
            <p>
              현재 베타 서비스로 운영 중이며 정식 출시 시 일부 데이터가 초기화될
              수 있습니다.
            </p>
          </div>
          <div className="mt-3 text-xs text-[#8a8f97]">
            <p>
              호담은 AI 기반 생성 서비스를 제공합니다. 생성 결과는 사용자 검토
              후 활용해 주세요.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
