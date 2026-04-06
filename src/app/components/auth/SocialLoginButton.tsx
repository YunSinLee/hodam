import Image from "next/image";

interface SocialLoginButtonProps {
  provider: "kakao" | "google";
  loading: boolean;
  disabled: boolean;
  onClick: () => void | Promise<void>;
}

const PROVIDER_CONFIG = {
  kakao: {
    iconSrc: "/kakao_logo.svg",
    iconAlt: "카카오 로그인",
    idleLabel: "카카오로 시작하기",
    loadingLabel: "로그인 중...",
    buttonClass:
      "bg-[#FEE500] text-[#3C1E1E] hover:bg-[#FFEB3B] disabled:bg-gray-300",
    spinnerClass: "border-[#3C1E1E] border-t-transparent",
    shimmerClass:
      "bg-gradient-to-r from-yellow-300/0 via-yellow-300/20 to-yellow-300/0",
  },
  google: {
    iconSrc: "/google_logo.svg",
    iconAlt: "구글 로그인",
    idleLabel: "Google로 시작하기",
    loadingLabel: "로그인 중...",
    buttonClass:
      "border-2 border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 disabled:border-gray-200 disabled:bg-gray-100",
    spinnerClass: "border-gray-600 border-t-transparent",
    shimmerClass:
      "bg-gradient-to-r from-gray-100/0 via-gray-100/50 to-gray-100/0",
  },
} as const;

export default function SocialLoginButton({
  provider,
  loading,
  disabled,
  onClick,
}: SocialLoginButtonProps) {
  const config = PROVIDER_CONFIG[provider];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "group relative w-full overflow-hidden rounded-2xl px-4 py-3 transition-all duration-300",
        "disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none",
        "hover:scale-[1.01] hover:shadow-lg",
        config.buttonClass,
      ].join(" ")}
    >
      <div className="relative z-10 flex items-center justify-center gap-3">
        {loading ? (
          <div
            className={`h-6 w-6 animate-spin rounded-full border-2 ${config.spinnerClass}`}
          />
        ) : (
          <Image
            src={config.iconSrc}
            alt={config.iconAlt}
            className="h-6 w-6"
            width={24}
            height={24}
          />
        )}
        <span className="text-base font-semibold sm:text-lg">
          {loading ? config.loadingLabel : config.idleLabel}
        </span>
      </div>

      {!loading && !disabled && (
        <div
          className={[
            "absolute inset-0 translate-x-[-100%] transition-transform duration-700",
            "group-hover:translate-x-[100%]",
            config.shimmerClass,
          ].join(" ")}
        />
      )}
    </button>
  );
}
