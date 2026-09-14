import { useEffect, useState } from "react";

import Image from "next/image";

import type { PicturebookPage as PicturebookPageType } from "@/app/types/openai";

interface PicturebookPageProps {
  page: PicturebookPageType;
  imageUrl?: string | null;
  isImageLoading?: boolean;
  showChoiceCue?: boolean;
  largeText?: boolean;
  onImageError?: (pageNumber: number) => void;
}

export default function PicturebookPage({
  page,
  imageUrl,
  isImageLoading = false,
  showChoiceCue = false,
  largeText = false,
  onImageError,
}: PicturebookPageProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [imageAttempt, setImageAttempt] = useState(0);
  const hasImageError = !!failedUrl && (!imageUrl || failedUrl === imageUrl);

  useEffect(() => {
    if (imageUrl) setFailedUrl(null);
  }, [imageUrl]);

  let imageStatus = "글부터 함께 읽어보세요";
  if (isImageLoading) {
    imageStatus = `${page.pageNumber}쪽 그림을 준비하고 있어요`;
  } else if (hasImageError) {
    imageStatus = "그림을 불러오지 못했어요. 글은 계속 읽을 수 있어요.";
  }

  return (
    <article
      aria-label={`${page.pageNumber}쪽`}
      className={`flex flex-col gap-3 rounded-xl border bg-[#fffaf2] p-5 shadow-sm sm:p-7 ${
        showChoiceCue
          ? "border-orange-300 ring-2 ring-orange-100"
          : "border-orange-100"
      }`}
    >
      <div>
        <div className="mb-4 flex items-center justify-between text-xs font-medium text-orange-700">
          <span>{`${page.pageNumber}쪽`}</span>
          <span className="rounded-full bg-white px-2 py-1 text-[11px] text-gray-500">
            잠자리 그림책
          </span>
        </div>

        {imageUrl && !hasImageError ? (
          <Image
            key={imageAttempt}
            src={imageUrl}
            width={1024}
            height={1024}
            unoptimized
            loading="eager"
            alt={`${page.pageNumber}쪽 이야기의 그림`}
            onError={() => {
              setFailedUrl(imageUrl);
              onImageError?.(page.pageNumber);
            }}
            className="mb-5 aspect-square w-full rounded-lg object-cover shadow-sm"
          />
        ) : (
          <div className="mb-5 flex min-h-[48px] w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-orange-200 bg-white/70 p-3 text-center text-sm leading-6 text-orange-700">
            <p role={hasImageError ? "status" : undefined}>{imageStatus}</p>
            {hasImageError && imageUrl && !onImageError && !isImageLoading && (
              <button
                type="button"
                className="text-link"
                onClick={() => {
                  setFailedUrl(null);
                  setImageAttempt(attempt => attempt + 1);
                }}
              >
                {page.pageNumber}쪽 그림 다시 불러오기
              </button>
            )}
          </div>
        )}
      </div>

      <div>
        <p
          className={`whitespace-pre-wrap text-gray-900 ${largeText ? "text-2xl leading-10" : "text-lg leading-8"}`}
        >
          {page.textKo}
        </p>
        {showChoiceCue && (
          <div className="mt-5 rounded-lg bg-orange-100 px-3 py-2 text-sm font-semibold text-orange-800">
            이 쪽을 읽고 아래 선택지에서 다음 행동을 골라주세요.
          </div>
        )}
      </div>
    </article>
  );
}
