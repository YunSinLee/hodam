import HButton from "@/app/components/atomic/HButton";

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
          <HButton
            children={
              <div className="flex gap-2 text-left">
                <span>{index + 1}. </span>
                <span className="flex flex-col gap-1">
                  <span>{selection.text}</span>
                  {isShowEnglish && <span>{selection.text_en}</span>}
                </span>
              </div>
            }
            onClick={() => clickSelection(selection.text)}
            size="md"
            color="orange"
            style="filled"
          />
        ))}
      </div>
    </div>
  );
}
