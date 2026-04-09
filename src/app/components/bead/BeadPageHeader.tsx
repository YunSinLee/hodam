import Image from "next/image";

export default function BeadPageHeader() {
  return (
    <header className="mb-6 text-center sm:mb-8">
      <div className="mb-4 flex justify-center">
        <Image
          src="/persimmon_240424.png"
          alt="곶감"
          className="h-16 w-16 sm:h-20 sm:w-20"
          width={80}
          height={80}
        />
      </div>
      <h1 className="mb-2 text-2xl font-bold text-gray-800 sm:text-3xl">
        곶감 충전
      </h1>
      <p className="text-sm text-gray-600 sm:text-base">
        AI 동화 생성에 필요한 곶감을 충전하세요
      </p>
    </header>
  );
}
