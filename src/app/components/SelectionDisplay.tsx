import type { SelectionDisplayProps } from "@/app/components/selection-display/selection-display-contract";
import {
  hasValidSelections,
  normalizeSelectionText,
} from "@/app/components/selection-display/selection-display-view";
import SelectionDisplayLoadingChoice from "@/app/components/selection-display/SelectionDisplayLoadingChoice";
import SelectionDisplayOptionItem from "@/app/components/selection-display/SelectionDisplayOptionItem";

export default function SelectionDisplay({
  selections,
  onSelectionClick,
  isShowEnglish = false,
  selectedChoice = "",
  isSelectionLoading = false,
  emptyMessage = "선택지를 불러오는 중...",
}: SelectionDisplayProps) {
  if (!Array.isArray(selections)) {
    return (
      <div className="flex flex-col items-center py-4">
        <p className="text-red-500">선택지를 불러올 수 없습니다.</p>
      </div>
    );
  }

  const handleSelectionClick = (text: string) => {
    if (isSelectionLoading) return;
    if (!text) return;
    onSelectionClick(text);
  };

  const hasSelections = hasValidSelections(selections);

  return (
    <div className="w-full space-y-3">
      {isSelectionLoading && selectedChoice ? (
        <SelectionDisplayLoadingChoice selectedChoice={selectedChoice} />
      ) : (
        selections.map((selection, index) => {
          if (!selection || typeof selection.text !== "string") return null;

          const normalizedText = normalizeSelectionText(selection);
          if (!normalizedText) return null;

          return (
            <SelectionDisplayOptionItem
              key={`${selection.text}-${selection.text_en}`}
              selection={selection}
              index={index}
              isShowEnglish={isShowEnglish}
              isSelected={selectedChoice === selection.text}
              isSelectionLoading={isSelectionLoading}
              onSelect={() => handleSelectionClick(normalizedText)}
            />
          );
        })
      )}

      {!hasSelections && !isSelectionLoading && (
        <div className="py-6 text-center">
          <p className="text-gray-500">{emptyMessage}</p>
        </div>
      )}
    </div>
  );
}
