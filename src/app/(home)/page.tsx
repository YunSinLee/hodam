"use client";

import Link from "next/link";
import HButton from "@/app/components/atomic/HButton";

export default function Home() {
  return (
    <div className="flex flex-col sm:flex-row items-center text-center gap-4 justify-center my-4">
      <img src="/Hodam1.png" className="w-72 h-80" />
      <div className="flex flex-col items-center gap-4 px-4">
        <div className="text-xl flex flex-col items-center gap-2">
          <p>
            호담은 사용자가 입력한 키워드를 바탕으로 동화를 만들어주는
            서비스입니다. 예를 들어,
          </p>
          <p className="text-2xl">철수, 호랑이, 사과</p>
          <p>를 입력하면 이에 맞추어서 동화를 만들어줍니다. </p>
          <p>시작하기 버튼을 눌러 호담을 시작해보세요.</p>
        </div>
        <Link href="./service">
          <HButton label="시작하기" size="xl" style="filled" />
        </Link>
        <div className="text-xl text-gray-500 max-w-xl flex flex-col items-center gap-2">
          <p>
            서비스는 현재 베타 버전입니다. 그에 따라 처음 회원가입 시 주어지는
            곶감만큼만 사용이 가능합니다.
          </p>
          <p>
            인공지능을 사용하기 때문에 생각보다 속도가 많이 느린 편입니다.(약
            30초 이상)
          </p>
          <p>
            모든 데이터는 정식 출시 시 사라질 수 있습니다. 여러 제안 및
            문의사항은{" "}
            <span className="text-orange-500">dldbstls7777@naver.com</span>
            으로 보내주시면, 참고하겠습니다.
          </p>
        </div>
      </div>
    </div>
  );
}
