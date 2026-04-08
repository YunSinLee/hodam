import React from "react";

interface KeywordInputProps {
  neededBeadCount: number;
  keywords: string;
  isEnglishIncluded: boolean;
  isImageIncluded: boolean;
  onKeywordsChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onButtonClicked: () => void;
  onEnglishIncludedChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onImageIncludedChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function KeywordInput({
  neededBeadCount,
  keywords,
  isEnglishIncluded,
  isImageIncluded,
  onKeywordsChange,
  onButtonClicked,
  onEnglishIncludedChange,
  onImageIncludedChange,
}: KeywordInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && keywords.trim().length > 0) {
      onButtonClicked();
    }
  };

  const hasKeywords = keywords.trim().length > 0;

  return (
    <section className="hodam-glass-card p-5 sm:p-6">
      <header className="mb-4">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#ef8d3d]/20 bg-white/70 px-3 py-1 text-xs font-semibold text-[#b7641f]">
          Story Builder
        </div>
        <h2 className="hodam-heading text-2xl text-[#2f3033]">
          키워드로 동화 만들기
        </h2>
        <p className="mt-2 text-sm text-[#6b7280]">
          콤마(,)로 구분해서 입력하세요. 예: 숲속, 토끼, 마법, 모험
        </p>
      </header>

      <div className="space-y-4">
        <div>
          <label
            htmlFor="story-keywords"
            className="mb-2 block text-sm font-semibold text-[#4b5563]"
          >
            키워드 입력
          </label>
          <input
            id="story-keywords"
            type="text"
            className="w-full rounded-2xl border border-[#ef8d3d]/25 bg-white/90 px-4 py-3 text-sm text-[#374151] shadow-[0_8px_20px_rgba(181,94,23,0.06)] outline-none transition focus:border-[#ef8d3d]/45 focus:ring-2 focus:ring-[#ef8d3d]/15"
            placeholder="예: 공룡, 바다, 별빛, 모험"
            value={keywords}
            onChange={onKeywordsChange}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label
            htmlFor="english-checkbox"
            className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[#ef8d3d]/20 bg-white/75 px-4 py-3"
          >
            <input
              type="checkbox"
              id="english-checkbox"
              checked={isEnglishIncluded}
              onChange={onEnglishIncludedChange}
              className="h-4 w-4 rounded border-[#dca16a] text-[#ef8d3d]"
            />
            <div>
              <p className="text-sm font-semibold text-[#374151]">
                영어 번역 포함
              </p>
              <p className="text-xs text-[#6b7280]">+1 곶감</p>
            </div>
          </label>

          <label
            htmlFor="image-checkbox"
            className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[#ef8d3d]/20 bg-white/75 px-4 py-3"
          >
            <input
              type="checkbox"
              id="image-checkbox"
              checked={isImageIncluded}
              onChange={onImageIncludedChange}
              className="h-4 w-4 rounded border-[#dca16a] text-[#ef8d3d]"
            />
            <div>
              <p className="text-sm font-semibold text-[#374151]">
                그림 생성 포함
              </p>
              <p className="text-xs text-[#6b7280]">+1 곶감</p>
            </div>
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#ef8d3d]/20 bg-[#fff8ef] px-4 py-3">
          <p className="text-sm font-semibold text-[#9f5a1c]">
            필요한 곶감: {neededBeadCount}개
          </p>
          <p className="text-xs text-[#b2773f]">로그인 후 즉시 생성 가능</p>
        </div>

        <button
          type="button"
          className={`w-full rounded-full px-4 py-3 text-sm font-bold transition-all ${
            hasKeywords
              ? "bg-gradient-to-r from-[#ef8d3d] to-[#f2b250] text-white shadow-[0_12px_24px_rgba(225,129,40,0.3)] hover:brightness-105"
              : "cursor-not-allowed bg-gray-200 text-gray-500"
          }`}
          onClick={onButtonClicked}
          disabled={!hasKeywords}
        >
          동화 만들기 시작
        </button>
      </div>
    </section>
  );
}
