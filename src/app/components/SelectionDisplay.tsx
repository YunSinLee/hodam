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
  onClear: _onClear,
  notice,
  isShowEnglish = false,
  selectedChoice = "",
  isSelectionLoading = false,
}: SelectionDisplayProps) {
  // 안전한 선택지 클릭 핸들러
  const handleSelectionClick = (selection: {
    text: string;
    text_en: string;
  }) => {
    try {
      // 로딩 중이면 클릭 무시
      if (isSelectionLoading) {
        return;
      }

      // 선택지 텍스트가 유효한지 확인
      if (!selection?.text || typeof selection.text !== "string") {
        console.error("Invalid selection text:", selection);
        alert("선택지 정보가 올바르지 않습니다.");
        return;
      }

      // 선택지 텍스트가 비어있지 않은지 확인
      if (selection.text.trim().length === 0) {
        console.error("Empty selection text");
        alert("선택지가 비어있습니다.");
        return;
      }

      // 콜백 함수 호출
      onSelectionClick(selection.text);
    } catch (error) {
      console.error("Error in selection click handler:", error);
      alert("선택지 처리 중 오류가 발생했습니다.");
    }
  };

  // selections 배열이 유효한지 확인
  if (!Array.isArray(selections)) {
    console.error("Invalid selections array:", selections);
    return (
      <div className="flex flex-col items-center">
        <p className="text-red-500">선택지를 불러올 수 없습니다.</p>
      </div>
    );
  }

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
          // 일반 선택지 표시
          selections.map((selection, index) => {
            // 각 선택지가 유효한지 확인
            if (!selection || typeof selection.text !== "string") {
              console.warn(`Invalid selection at index ${index}:`, selection);
              return null;
            }

            const isSelected = selectedChoice === selection.text;
            const isDisabled = isSelectionLoading;

            return (
              <div
                key={`selection-${index}-${selection.text.substring(0, 10)}`}
                className={`p-4 rounded-md shadow-sm transition-all border cursor-pointer
                  ${
                    isSelected
                      ? "bg-orange-100 border-orange-400 shadow-md"
                      : isDisabled
                        ? "bg-gray-100 border-gray-300 cursor-not-allowed opacity-60"
                        : "bg-white border-orange-200 hover:border-orange-500 hover:shadow-md"
                  }`}
                onClick={() => !isDisabled && handleSelectionClick(selection)}
              >
                <div className="flex items-start gap-3">
                  {/* 선택지 번호 */}
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0
                    ${
                      isSelected
                        ? "bg-orange-500 text-white"
                        : isDisabled
                          ? "bg-gray-400 text-white"
                          : "bg-orange-200 text-orange-700"
                    }`}
                  >
                    {index + 1}
                  </div>

                  <div className="flex-1">
                    <p
                      className={`font-medium ${isSelected ? "text-orange-800" : isDisabled ? "text-gray-500" : "text-gray-800"}`}
                    >
                      {selection.text}
                    </p>
                    {isShowEnglish && selection.text_en && (
                      <p
                        className={`font-medium italic mt-1 ${isSelected ? "text-orange-600" : isDisabled ? "text-gray-400" : "text-gray-600"}`}
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
