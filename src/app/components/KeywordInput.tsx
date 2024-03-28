export default function KeywordInput({
  neededBeadCount,
  keywords,
  assistantType,
  isEnglishIncluded,
  isImageIncluded,
  onKeywordsChange,
  onButtonClicked,
  onAssistantTypeChange,
  onEnglishIncludedChange,
  onImageIncludedChange,
}: {
  neededBeadCount: number;
  keywords: string;
  assistantType: "default" | "traditional";
  isEnglishIncluded: boolean;
  isImageIncluded: boolean;
  onKeywordsChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onButtonClicked: () => void;
  onAssistantTypeChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onEnglishIncludedChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onImageIncludedChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  function onAssistantClicked(e: React.ChangeEvent<HTMLInputElement>) {
    onAssistantTypeChange({
      target: { value: e.target.checked ? "traditional" : "default" },
    } as React.ChangeEvent<HTMLSelectElement>);
  }
  function onLanguageClicked(e: React.ChangeEvent<HTMLInputElement>) {
    onEnglishIncludedChange(e);
  }

  return (
    <div className="flex flex-col w-full my-8">
      <div className="flex items-center gap-8">
        <input
          className="form-input text-xl flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 shadow-sm"
          type="text"
          value={keywords}
          onChange={onKeywordsChange}
        />
        <button
          className="flex items-center gap-4 text-xl px-4 py-2 bg-orange-500 hover:bg-orange-700 text-white border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 shadow"
          onClick={onButtonClicked}
        >
          <span>이야기를 들려줘!</span>
          <div className="flex items-center">
            <img src="bead.png" className="w-8 h-8" /> X {neededBeadCount}{" "}
          </div>
        </button>
      </div>
      <div className="flex gap-8">
        {/* <label>
          <input
            type="checkbox"
            checked={assistantType === "traditional"}
            onChange={e => onAssistantClicked(e)}
          />
          전통적
        </label> */}
        <label className="text-xl">
          <input
            className="w-8"
            type="checkbox"
            checked={isEnglishIncluded}
            onChange={e => onLanguageClicked(e)}
          />
          영어포함하기
        </label>
        <label className="text-xl">
          <input
            className="w-8"
            type="checkbox"
            checked={isImageIncluded}
            onChange={onImageIncludedChange}
          />
          그림포함하기
        </label>
      </div>
    </div>
  );
}
