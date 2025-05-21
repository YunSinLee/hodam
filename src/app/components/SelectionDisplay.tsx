import HButton from "@/app/components/atomic/HButton";

interface SelectionDisplayProps {
  selections: {
    text: string;
    text_en: string;
  }[];
  isShowEnglish: boolean;
  clickSelection: (selection: string) => void;
  notice: string;
}

export default function SelectionDisplay({
  selections,
  isShowEnglish,
  clickSelection,
  notice,
}: SelectionDisplayProps) {
  return (
    <div className="flex flex-col items-center">
      <h2 className="text-xl font-bold mb-4">{notice}</h2>
      <div className="flex flex-col gap-4">
        {selections.map((selection, index) => (
          <div
            key={index}
            className="p-4 bg-white rounded-md shadow-sm hover:shadow-md cursor-pointer transition-all border border-orange-200 hover:border-orange-500"
            onClick={() => clickSelection(selection.text)}
          >
            <p className="text-gray-800 font-medium">{selection.text}</p>
            {isShowEnglish && selection.text_en && (
              <p className="text-gray-600 italic mt-2">{selection.text_en}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
