export default function SelectionDisplay({
  selections,
  isShowEnglish,
  clickSelection,
  notice,
}: {
  selections: { text: string; text_en: string }[];
  isShowEnglish: boolean;
  clickSelection: (selection: string) => void;
  notice: string;
}) {
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">{notice}</h2>
      <div className="flex flex-col gap-4">
        {selections.map((selection, index) => (
          <button
            className="flex gap-2 text-left text-xl leading-8 px-4 py-2 bg-orange-500 hover:bg-orange-700 text-white border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 shadow"
            key={index}
            onClick={() => clickSelection(selection.text)}
          >
            <span>{index + 1}. </span>
            <span className="flex flex-col gap-1">
              <span>{selection.text}</span>
              {isShowEnglish && <span>{selection.text_en}</span>}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
