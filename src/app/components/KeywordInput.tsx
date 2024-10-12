import HButton from "@/app/components/atomic/HButton";

export default function KeywordInput({
  neededBeadCount,
  keywords,
  // assistantType,
  isEnglishIncluded,
  isImageIncluded,
  onKeywordsChange,
  onButtonClicked,
  // onAssistantTypeChange,
  onEnglishIncludedChange,
  onImageIncludedChange,
}: {
  neededBeadCount: number;
  keywords: string;
  // assistantType: "default" | "traditional";
  isEnglishIncluded: boolean;
  isImageIncluded: boolean;
  onKeywordsChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onButtonClicked: () => void;
  // onAssistantTypeChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onEnglishIncludedChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onImageIncludedChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  // function onAssistantClicked(e: React.ChangeEvent<HTMLInputElement>) {
  //   onAssistantTypeChange({
  //     target: { value: e.target.checked ? "traditional" : "default" },
  //   } as React.ChangeEvent<HTMLSelectElement>);
  // }
  function onLanguageClicked(e: React.ChangeEvent<HTMLInputElement>) {
    onEnglishIncludedChange(e);
  }

  return (
    <div className="flex flex-col sm:flex-row gap-8 items-center sm:items-start w-full my-8 px-8">
      <div className="flex flex-col items-center sm:items-start gap-2 w-full">
        <input
          className="form-input text-xl w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 shadow-sm"
          type="text"
          value={keywords}
          placeholder="예시) 윤신, 마법, 도서관"
          onChange={onKeywordsChange}
        />
        <div className="flex gap-8">
          {/* <label>
            <input
              type="checkbox"
              checked={assistantType === "traditional"}
              onChange={e => onAssistantClicked(e)}
            />
            전통적
          </label> */}
          <label className="text-sm sm:text-xl" htmlFor="isEnglishIncluded">
            <input
              className="w-8"
              type="checkbox"
              checked={isEnglishIncluded}
              onChange={e => onLanguageClicked(e)}
            />
            영어포함
          </label>
          <label className="text-sm sm:text-xl" htmlFor="isImageIncluded">
            <input
              id="imageIncluded"
              className="w-8"
              type="checkbox"
              checked={isImageIncluded}
              onChange={onImageIncludedChange}
            />
            그림포함
          </label>
        </div>
      </div>
      <HButton onClick={onButtonClicked} buttonStyle="filled">
        <div className="flex items-center gap-2 justify-center sm:gap-4 sm:min-w-32">
          <span className="text-md sm:text-xl">시작!</span>
          <div className="flex items-center">
            <img
              src="persimmon_240424.png"
              className="w-6 sm:w-8 h-6 sm:h-8 text-md sm:text-xl"
            />{" "}
            X {neededBeadCount}{" "}
          </div>
        </div>
      </HButton>
    </div>
  );
}
