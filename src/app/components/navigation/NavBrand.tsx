import Image from "next/image";
import Link from "next/link";

export default function NavBrand() {
  return (
    <Link href="/" className="group flex items-center space-x-3">
      <div className="relative">
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-r from-orange-400 to-amber-400 flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-105">
          <Image
            src="/hodam.png"
            className="w-6 h-6 sm:w-8 sm:h-8 filter brightness-0 invert"
            alt="호담 로고"
            width={32}
            height={32}
          />
        </div>
        <div className="absolute -inset-1 bg-gradient-to-r from-orange-400 to-amber-400 rounded-full opacity-0 group-hover:opacity-20 blur transition-all duration-300" />
      </div>
      <div className="flex flex-col">
        <span className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
          HODAM
        </span>
        <span className="text-xs text-gray-500 hidden sm:block">
          AI 동화 생성
        </span>
      </div>
    </Link>
  );
}
