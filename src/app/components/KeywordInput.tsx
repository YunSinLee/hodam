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
  const canSubmit = keywords.trim().length > 0;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && canSubmit) {
      onButtonClicked();
    }
  };

  return (
    <section className="rounded-2xl border border-orange-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4">
        <h2 className="mb-2 text-lg font-bold text-orange-700 sm:text-xl">
          키워드로 동화 만들기
        </h2>
        <p className="mb-2 text-sm text-gray-600" aria-live="polite">
          콤마(,)로 구분된 키워드를 입력하세요. 필요한 곶감:{" "}
          <span className="font-semibold text-orange-700">
            {neededBeadCount}
          </span>
          개
        </p>
        <input
          type="text"
          className="w-full rounded-xl border border-orange-200 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-orange-500"
          placeholder="예: 숲속, 토끼, 마법, 모험"
          value={keywords}
          onChange={onKeywordsChange}
          onKeyDown={handleKeyDown}
          inputMode="text"
          autoComplete="off"
        />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label
          htmlFor="english-checkbox"
          className={`flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
            isEnglishIncluded
              ? "border-orange-400 bg-orange-50 text-orange-700"
              : "border-orange-200 bg-white text-gray-700"
          }`}
        >
          <input
            type="checkbox"
            id="english-checkbox"
            checked={isEnglishIncluded}
            onChange={onEnglishIncludedChange}
            className="w-4 h-4 text-orange-600"
          />
          영어 번역 (+1 곶감)
        </label>

        <label
          htmlFor="image-checkbox"
          className={`flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
            isImageIncluded
              ? "border-orange-400 bg-orange-50 text-orange-700"
              : "border-orange-200 bg-white text-gray-700"
          }`}
        >
          <input
            type="checkbox"
            id="image-checkbox"
            checked={isImageIncluded}
            onChange={onImageIncludedChange}
            className="w-4 h-4 text-orange-600"
          />
          그림 생성 (+1 곶감)
        </label>
      </div>

      <button
        type="button"
        className={`min-h-[44px] w-full rounded-xl px-4 py-2 font-medium transition-colors ${
          canSubmit
            ? "bg-orange-500 text-white hover:bg-orange-600"
            : "cursor-not-allowed bg-gray-300 text-gray-500"
        }`}
        onClick={onButtonClicked}
        disabled={!canSubmit}
      >
        동화 만들기 시작
      </button>
    </section>
  );
}
