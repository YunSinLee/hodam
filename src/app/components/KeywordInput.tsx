export default function KeywordInput({
  keywords,
  onKeywordsChange,
  onButtonClicked,
}: {
  keywords: string;
  onKeywordsChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onButtonClicked: () => void;
}) {
  return (
    <div className="flex items-center gap-8 w-full my-8">
      <input
        className="form-input text-xl flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 shadow-sm"
        type="text"
        value={keywords}
        onChange={onKeywordsChange}
      />
      <button
        className="text-xl px-4 py-2 bg-orange-500 hover:bg-orange-700 text-white border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 shadow"
        onClick={onButtonClicked}
      >
        이야기를 들려줘!
      </button>
    </div>
  );
}
