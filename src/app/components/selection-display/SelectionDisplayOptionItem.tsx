import type { SelectionItem } from "@/app/components/selection-display/selection-display-contract";
import {
  getSelectionBadgeClass,
  getSelectionContainerClass,
  getSelectionEnglishTextClass,
  getSelectionTextClass,
} from "@/app/components/selection-display/selection-display-view";

interface SelectionDisplayOptionItemProps {
  selection: SelectionItem;
  index: number;
  isShowEnglish: boolean;
  isSelected: boolean;
  isSelectionLoading: boolean;
  onSelect: () => void;
}

export default function SelectionDisplayOptionItem({
  selection,
  index,
  isShowEnglish,
  isSelected,
  isSelectionLoading,
  onSelect,
}: SelectionDisplayOptionItemProps) {
  const isDisabled = isSelectionLoading;

  return (
    <button
      type="button"
      className={`w-full rounded-xl border p-4 text-left shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 ${getSelectionContainerClass(
        isSelected,
        isDisabled,
      )}`}
      onClick={onSelect}
      disabled={isDisabled}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${getSelectionBadgeClass(
            isSelected,
            isDisabled,
          )}`}
        >
          {index + 1}
        </div>

        <div className="flex-1">
          <p
            className={`font-medium ${getSelectionTextClass(
              isSelected,
              isDisabled,
            )}`}
          >
            {selection.text}
          </p>
          {isShowEnglish && selection.text_en && (
            <p
              className={`mt-1 italic ${getSelectionEnglishTextClass(
                isSelected,
                isDisabled,
              )}`}
            >
              {selection.text_en}
            </p>
          )}
        </div>

        {isSelected && isSelectionLoading && (
          <div className="h-5 w-5 flex-shrink-0 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
        )}
      </div>
    </button>
  );
}
