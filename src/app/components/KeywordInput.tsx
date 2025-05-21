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

  return (
    <div className="p-4 bg-white rounded-md shadow-md border border-orange-300">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-orange-700 mb-2">
          키워드로 동화 만들기
        </h2>
        <p className="text-sm text-gray-600 mb-1">
          콤마(,)로 구분된 키워드를 입력하세요. 필요한 곶감: {neededBeadCount}개
        </p>
        <input
          type="text"
          className="w-full px-4 py-2 border border-orange-200 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
          placeholder="예: 숲속, 토끼, 마법, 모험"
          value={keywords}
          onChange={onKeywordsChange}
          onKeyDown={handleKeyDown}
        />
      </div>

      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="english-checkbox"
            checked={isEnglishIncluded}
            onChange={onEnglishIncludedChange}
            className="w-4 h-4 text-orange-600"
          />
          <label htmlFor="english-checkbox" className="text-sm">
            영어 번역 (+1 곶감)
          </label>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="image-checkbox"
            checked={isImageIncluded}
            onChange={onImageIncludedChange}
            className="w-4 h-4 text-orange-600"
          />
          <label htmlFor="image-checkbox" className="text-sm">
            그림 생성 (+1 곶감)
          </label>
        </div>
      </div>

      <button
        className={`w-full py-2 px-4 rounded-md transition-colors ${
          keywords.length > 0
            ? "bg-orange-500 text-white hover:bg-orange-600"
            : "bg-gray-300 text-gray-500 cursor-not-allowed"
        }`}
        onClick={onButtonClicked}
        disabled={keywords.length === 0}
      >
        동화 만들기 시작
      </button>
    </div>
  );
}
