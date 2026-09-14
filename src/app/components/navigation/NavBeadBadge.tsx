import Image from "next/image";
import Link from "next/link";

interface NavBeadBadgeProps {
  count?: number | null;
}

export default function NavBeadBadge({ count }: NavBeadBadgeProps) {
  if (typeof count !== "number") {
    return null;
  }

  return (
    <Link href="/bead" className="group">
      <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-orange-100 to-amber-100 rounded-full border border-orange-200 hover:border-orange-300 transition-all duration-200 hover:shadow-md">
        <div className="relative">
          <Image
            src="/persimmon_240424.png"
            className="w-6 h-6 group-hover:scale-110 transition-transform duration-200"
            alt="곶감"
            width={24}
            height={24}
          />
        </div>
        <span className="text-sm font-semibold text-orange-700 min-w-[20px] text-center">
          {count}
        </span>
      </div>
    </Link>
  );
}
