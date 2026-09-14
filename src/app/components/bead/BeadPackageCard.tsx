import Image from "next/image";

import type { BeadPackage } from "@/lib/payments/packages";

interface BeadPackageCardProps {
  pkg: BeadPackage;
  isLoading: boolean;
  isSelected: boolean;
  onPurchase: (pkg: BeadPackage) => void;
}

function getPurchaseButtonClass(
  pkg: BeadPackage,
  isLoading: boolean,
  isSelected: boolean,
) {
  if (isLoading && isSelected) {
    return "cursor-not-allowed bg-gray-300 text-gray-500";
  }
  if (pkg.popular) {
    return "bg-orange-500 text-white shadow-lg hover:bg-orange-600 hover:shadow-xl";
  }
  return "bg-gray-100 text-gray-800 hover:bg-orange-100 hover:text-orange-700";
}

export default function BeadPackageCard({
  pkg,
  isLoading,
  isSelected,
  onPurchase,
}: BeadPackageCardProps) {
  return (
    <article
      className={`relative rounded-2xl border-2 bg-white p-5 text-center transition-all duration-300 hover:shadow-lg sm:p-6 ${
        pkg.popular
          ? "scale-[1.02] border-orange-400 shadow-lg"
          : "border-gray-200 hover:border-orange-300"
      }`}
    >
      {pkg.popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 transform">
          <span className="rounded-full bg-orange-500 px-3 py-1 text-sm font-medium text-white">
            인기
          </span>
        </div>
      )}

      <div className="mb-4 flex items-center justify-center">
        <Image
          src="/persimmon_240424.png"
          alt="곶감"
          className="mr-2 h-12 w-12"
          width={48}
          height={48}
        />
        <span className="text-2xl font-bold text-gray-800">
          ×{pkg.quantity}
        </span>
      </div>

      <div className="mb-4">
        <div className="mb-1 text-sm text-gray-500 line-through">
          {pkg.originalPrice.toLocaleString()}원
        </div>
        <div className="mb-1 text-2xl font-bold text-orange-600">
          {pkg.price.toLocaleString()}원
        </div>
        <div className="text-sm font-medium text-green-600">
          {pkg.discount}% 할인
        </div>
      </div>

      <p className="mb-4 text-sm text-gray-500">{pkg.description}</p>

      <button
        type="button"
        onClick={() => onPurchase(pkg)}
        disabled={isLoading}
        className={`w-full rounded-xl px-4 py-3 font-medium transition-all duration-300 ${getPurchaseButtonClass(
          pkg,
          isLoading,
          isSelected,
        )}`}
      >
        {isLoading && isSelected ? (
          <span className="flex items-center justify-center">
            <span className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
            결제 중...
          </span>
        ) : (
          "구매하기"
        )}
      </button>
    </article>
  );
}
