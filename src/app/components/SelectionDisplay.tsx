interface SelectionDisplayProps {
  selections: { text: string; text_en: string }[];
  onSelectionClick: (selection: string) => void;
  onClear?: () => void;
  notice: string;
  isShowEnglish?: boolean;
}

export default function SelectionDisplay({
  selections,
  onSelectionClick,
  onClear: _onClear,
  notice,
  isShowEnglish = false,
}: SelectionDisplayProps) {
  return (
    <div className="flex flex-col items-center">
      <h2 className="text-xl font-bold mb-4">{notice}</h2>
      <div className="flex flex-col gap-4">
        {selections.map((selection, index) => (
          <div
            key={index}
            className="p-4 bg-white rounded-md shadow-sm hover:shadow-md cursor-pointer transition-all border border-orange-200 hover:border-orange-500"
            onClick={() => onSelectionClick(selection.text)}
          >
            <p className="text-gray-800 font-medium">{selection.text}</p>
            {isShowEnglish && selection.text_en && (
              <p className="text-gray-600 font-medium italic mt-1">
                {selection.text_en}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
