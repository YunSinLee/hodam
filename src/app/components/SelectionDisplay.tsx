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
      return "bg-orange-100 border-orange-400 shadow-md";
    }
    if (isDisabled) {
      return "bg-gray-100 border-gray-300 cursor-not-allowed opacity-60";
    }
    return "bg-white border-orange-200 hover:border-orange-500 hover:shadow-md";
  };

  const getSelectionBadgeClass = (isSelected: boolean, isDisabled: boolean) => {
    if (isSelected) {
      return "bg-orange-500 text-white";
    }
    if (isDisabled) {
      return "bg-gray-400 text-white";
    }
    return "bg-orange-200 text-orange-700";
  };

  const getSelectionTextClass = (isSelected: boolean, isDisabled: boolean) => {
    if (isSelected) return "text-orange-800";
    if (isDisabled) return "text-gray-500";
    return "text-gray-800";
  };

  const getSelectionEnglishTextClass = (
    isSelected: boolean,
    isDisabled: boolean,
  ) => {
    if (isSelected) return "text-orange-600";
    if (isDisabled) return "text-gray-400";
    return "text-gray-600";
  };

  return (
    <div className="flex flex-col items-center">
      <h2 className="text-xl font-bold mb-4">
        {notice || "다음 전개를 선택하세요"}
      </h2>

      <div className="flex flex-col gap-4 w-full">
        {/* 로딩 중일 때는 선택된 선택지만 표시 */}
        {isSelectionLoading && selectedChoice ? (
          <div className="p-4 bg-orange-100 border border-orange-400 rounded-md shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                ✓
              </div>
              <div className="flex-1">
                <p className="text-orange-800 font-medium">{selectedChoice}</p>
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-4 h-4 border-2 border-orange-500 rounded-full border-t-transparent animate-spin" />
                  <p className="text-orange-600 text-sm">
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
              <div
                key={`${selection.text}-${selection.text_en}`}
                className={`p-4 rounded-md shadow-sm transition-all border cursor-pointer
                  ${getSelectionContainerClass(isSelected, isDisabled)}`}
                onClick={() => !isDisabled && handleSelectionClick(selection)}
              >
                <div className="flex items-start gap-3">
                  {/* 선택지 번호 */}
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0
                    ${getSelectionBadgeClass(isSelected, isDisabled)}`}
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
                        className={`font-medium italic mt-1 ${getSelectionEnglishTextClass(
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
                    <div className="w-5 h-5 border-2 border-orange-500 rounded-full border-t-transparent animate-spin flex-shrink-0" />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {selections.length === 0 && !isSelectionLoading && (
        <div className="text-center py-8">
          <p className="text-gray-500">선택지를 불러오는 중...</p>
        </div>
      )}
    </div>
  );
}
