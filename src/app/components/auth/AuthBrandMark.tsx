import Image from "next/image";

interface AuthBrandMarkProps {
  size?: "md" | "lg";
  className?: string;
}

export default function AuthBrandMark({
  size = "md",
  className,
}: AuthBrandMarkProps) {
  const wrapperSizeClass =
    size === "lg" ? "h-20 w-20 sm:h-24 sm:w-24" : "h-14 w-14 sm:h-16 sm:w-16";
  const logoSize = size === "lg" ? 48 : 36;
  const rootClasses = ["flex justify-center", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClasses}>
      <div
        className={`${wrapperSizeClass} relative flex items-center justify-center rounded-full bg-gradient-to-r from-[#ef8d3d] to-[#f2b250] shadow-[0_12px_26px_rgba(215,120,37,0.34)]`}
      >
        <div className="absolute -inset-1 rounded-full border border-white/50" />
        <Image
          src="/hodam.png"
          alt="호담 로고"
          className="h-auto w-auto brightness-0 invert"
          width={logoSize}
          height={logoSize}
          priority
        />
      </div>
    </div>
  );
}
