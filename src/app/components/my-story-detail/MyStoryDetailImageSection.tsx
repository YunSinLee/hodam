import Image from "next/image";

import type { MyStoryDetailImageSectionProps } from "@/app/components/my-story-detail/my-story-detail-contract";

export default function MyStoryDetailImageSection({
  imageUrl,
}: MyStoryDetailImageSectionProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
      <div className="border-b border-gray-100 p-4 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          동화 일러스트
        </h2>
      </div>
      <div className="p-4 sm:p-6">
        <div className="group relative">
          <Image
            src={imageUrl}
            alt="동화 일러스트"
            className="w-full rounded-lg shadow-md transition-transform duration-300 group-hover:scale-[1.02]"
            width={1024}
            height={1024}
            unoptimized
          />
          <div className="absolute inset-0 rounded-lg bg-black bg-opacity-0 transition-all duration-300 group-hover:bg-opacity-10" />
        </div>
      </div>
    </section>
  );
}
