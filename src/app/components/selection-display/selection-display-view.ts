import type { SelectionItem } from "@/app/components/selection-display/selection-display-contract";

export function hasValidSelections(selections: SelectionItem[]): boolean {
  return selections.some(
    selection => typeof selection?.text === "string" && selection.text.trim(),
  );
}

export function normalizeSelectionText(selection: SelectionItem): string {
  return selection?.text?.trim() || "";
}

export function getSelectionContainerClass(
  isSelected: boolean,
  isDisabled: boolean,
): string {
  if (isSelected) {
    return "border-orange-400 bg-orange-100 shadow-sm";
  }
  if (isDisabled) {
    return "cursor-not-allowed border-gray-300 bg-gray-100 opacity-70";
  }
  return "border-orange-200 bg-white hover:border-orange-500 hover:shadow-sm";
}

export function getSelectionBadgeClass(
  isSelected: boolean,
  isDisabled: boolean,
): string {
  if (isSelected) {
    return "bg-orange-500 text-white";
  }
  if (isDisabled) {
    return "bg-gray-400 text-white";
  }
  return "bg-orange-200 text-orange-700";
}

export function getSelectionTextClass(
  isSelected: boolean,
  isDisabled: boolean,
): string {
  if (isSelected) return "text-orange-800";
  if (isDisabled) return "text-gray-500";
  return "text-gray-800";
}

export function getSelectionEnglishTextClass(
  isSelected: boolean,
  isDisabled: boolean,
): string {
  if (isSelected) return "text-orange-700";
  if (isDisabled) return "text-gray-400";
  return "text-gray-600";
}
