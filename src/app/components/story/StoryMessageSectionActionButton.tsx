interface StoryMessageSectionActionButtonProps {
  isEnglishIncluded: boolean;
  isShowEnglish: boolean;
  translationInProgress: boolean;
  onToggleEnglish: () => void;
  onTranslate: () => void;
}

export default function StoryMessageSectionActionButton({
  isEnglishIncluded,
  isShowEnglish,
  translationInProgress,
  onToggleEnglish,
  onTranslate,
}: StoryMessageSectionActionButtonProps) {
  if (isEnglishIncluded) {
    return (
      <button
        type="button"
        className={`inline-flex w-full items-center justify-center rounded-md px-3 py-2 text-sm font-medium sm:w-auto ${
          isShowEnglish
            ? "bg-orange-500 text-white"
            : "bg-gray-200 text-gray-700"
        }`}
        onClick={onToggleEnglish}
      >
        {isShowEnglish ? "한국어만 보기" : "영어 함께 보기"}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`inline-flex w-full items-center justify-center rounded-md px-3 py-2 text-sm font-medium sm:w-auto ${
        translationInProgress
          ? "cursor-not-allowed bg-gray-400 text-white"
          : "bg-orange-500 text-white"
      }`}
      onClick={onTranslate}
      disabled={translationInProgress}
    >
      {translationInProgress ? "번역 중..." : "영어로 번역하기"}
    </button>
  );
}
