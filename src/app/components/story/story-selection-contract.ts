import type { SelectionItem } from "@/app/components/selection-display/selection-display-contract";

export interface StorySelectionSectionState {
  notice: string;
  selections: SelectionItem[];
  isShowEnglish: boolean;
  selectedChoice: string;
  isSelectionLoading: boolean;
}

export interface StorySelectionSectionHandlers {
  onSelectionClick: (selection: string) => void;
}
