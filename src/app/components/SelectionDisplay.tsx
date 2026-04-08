interface SelectionDisplayProps {
  selections: { text: string; text_en: string }[];
  onSelectionClick: (selection: string) => void;
  onClear?: () => void;
  notice: string;
  isShowEnglish?: boolean;
  selectedChoice?: string;
  isSelectionLoading?: boolean;
}

export default function SelectionDisplay({
  selections,
  onSelectionClick,
  onClear,
  notice,
  isShowEnglish = false,
  selectedChoice = "",
  isSelectionLoading = false,
}: SelectionDisplayProps) {
  const handleSelectionClick = (selection: {
    text: string;
    text_en: string;
  }) => {
    if (isSelectionLoading) return;

    const normalizedSelectionText = selection?.text?.trim();
    if (!normalizedSelectionText) return;

    onClear?.();
    onSelectionClick(normalizedSelectionText);
  };

  if (!Array.isArray(selections)) {
    return (
      <div className="flex flex-col items-center">
        <p className="text-red-500">선택지를 불러올 수 없습니다.</p>
      </div>
    );
  }

  const getSelectionContainerClass = (
    isSelected: boolean,
    isDisabled: boolean,
  ) => {
    if (isSelected) {
      return "bg-[#fff2e1] border-[#ef8d3d]/60 shadow-[0_10px_22px_rgba(181,94,23,0.12)]";
    }
    if (isDisabled) {
      return "bg-gray-100 border-gray-300 cursor-not-allowed opacity-70";
    }
    return "bg-white border-[#ef8d3d]/25 hover:border-[#ef8d3d]/50 hover:shadow-[0_10px_20px_rgba(181,94,23,0.1)]";
  };

  const getSelectionBadgeClass = (isSelected: boolean, isDisabled: boolean) => {
    if (isSelected) {
      return "bg-[#ef8d3d] text-white";
    }
    if (isDisabled) {
      return "bg-gray-400 text-white";
    }
    return "bg-[#ffe4c3] text-[#a25a1d]";
  };

  const getSelectionTextClass = (isSelected: boolean, isDisabled: boolean) => {
    if (isSelected) return "text-[#8f4f16]";
    if (isDisabled) return "text-gray-500";
    return "text-[#2f3033]";
  };

  const getSelectionEnglishTextClass = (
    isSelected: boolean,
    isDisabled: boolean,
  ) => {
    if (isSelected) return "text-[#ae672c]";
    if (isDisabled) return "text-gray-400";
    return "text-gray-600";
  };

  return (
    <div className="flex flex-col items-center">
      <h2 className="mb-4 text-xl font-bold text-[#2f3033]">
        {notice || "다음 전개를 선택하세요"}
      </h2>

      <div className="flex flex-col gap-4 w-full">
        {/* 로딩 중일 때는 선택된 선택지만 표시 */}
        {isSelectionLoading && selectedChoice ? (
          <div className="rounded-xl border border-[#ef8d3d]/50 bg-[#fff2e1] p-4 shadow-[0_10px_22px_rgba(181,94,23,0.12)]">
            <div className="flex items-center gap-3">
              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#ef8d3d] text-sm font-bold text-white">
                ✓
              </div>
              <div className="flex-1">
                <p className="font-medium text-[#8f4f16]">{selectedChoice}</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#ef8d3d] border-t-transparent" />
                  <p className="text-sm text-[#ae672c]">
                    이야기를 생성하고 있습니다...
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          selections.map((selection, index) => {
            if (!selection || typeof selection.text !== "string") return null;
            const isSelected = selectedChoice === selection.text;
            const isDisabled = isSelectionLoading;

            return (
              <button
                key={`${selection.text}-${selection.text_en}`}
                type="button"
                className={`w-full rounded-xl border p-4 text-left shadow-sm transition-all ${getSelectionContainerClass(
                  isSelected,
                  isDisabled,
                )}`}
                onClick={() => !isDisabled && handleSelectionClick(selection)}
                disabled={isDisabled}
                aria-label={`선택지 ${index + 1}: ${selection.text}`}
              >
                <div className="flex items-start gap-3">
                  {/* 선택지 번호 */}
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
                        className={`mt-1 font-medium italic ${getSelectionEnglishTextClass(
                          isSelected,
                          isDisabled,
                        )}`}
                      >
                        {selection.text_en}
                      </p>
                    )}
                  </div>

                  {/* 로딩 스피너 (선택된 항목에만 표시) */}
                  {isSelected && isSelectionLoading && (
                    <div className="h-5 w-5 flex-shrink-0 animate-spin rounded-full border-2 border-[#ef8d3d] border-t-transparent" />
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {selections.length === 0 && !isSelectionLoading && (
        <div className="py-8 text-center">
          <p className="text-gray-500">선택지를 불러오는 중...</p>
        </div>
      )}
    </div>
  );
}
