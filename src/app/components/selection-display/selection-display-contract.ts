import type { StorySelectionViewModel } from "@/app/service/story-page-state";

export type SelectionItem = Pick<StorySelectionViewModel, "text" | "text_en">;

export interface SelectionDisplayProps {
  selections: SelectionItem[];
  onSelectionClick: (selection: string) => void;
  isShowEnglish?: boolean;
  selectedChoice?: string;
  isSelectionLoading?: boolean;
  emptyMessage?: string;
}
