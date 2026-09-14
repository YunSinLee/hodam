import type {
  PicturebookDraft,
  PicturebookInput,
  PicturebookStoryGuide,
} from "@/app/types/openai";

export const initialInput: PicturebookInput = {
  childName: "",
  childAge: "",
  situation: "",
  lesson: "",
  tone: "calm",
  interests: "",
};
export const situationExamples = {
  brushing: {
    label: "양치가 싫어요",
    situation: "양치를 하기 싫어해서 잠들기 전마다 실랑이를 해요.",
    lesson: "조금씩 시도하면 낯선 일도 할 수 있다는 마음",
    interests: "",
  },
  friends: {
    label: "친구와 나누기",
    situation: "친구에게 장난감을 빌려주기 어려워했어요.",
    lesson: "내 마음도 소중하고 함께 노는 즐거움도 있다는 것",
    interests: "",
  },
  dark: {
    label: "어두운 밤이 무서워요",
    situation: "불을 끄면 무섭다며 혼자 잠들기 어려워해요.",
    lesson: "곁에 있는 따뜻함을 느끼며 천천히 안심하는 마음",
    interests: "",
  },
};

export function validatePicturebookInput(value: unknown): string | null {
  if (!value || typeof value !== "object")
    return "아이의 이야기를 입력해주세요.";
  const input = value as PicturebookInput;
  if (
    typeof input.childName !== "string" ||
    !input.childName.trim() ||
    input.childName.length > 20
  )
    return "이름이나 별명은 1~20자로 적어주세요.";
  if (
    typeof input.childAge !== "string" ||
    !/^(?:[3-9]|1[0-2])$/.test(input.childAge)
  )
    return "아이 나이는 3~12세 중에서 골라주세요.";
  if (
    typeof input.situation !== "string" ||
    !input.situation.trim() ||
    input.situation.length > 500
  )
    return "오늘의 상황을 1~500자로 적어주세요.";
  if (
    typeof input.lesson !== "string" ||
    !input.lesson.trim() ||
    input.lesson.length > 200
  )
    return "전하고 싶은 마음을 1~200자로 적어주세요.";
  if (!["calm", "playful", "brave"].includes(input.tone))
    return "이야기 분위기를 골라주세요.";
  if (
    input.interests !== undefined &&
    (typeof input.interests !== "string" || input.interests.length > 100)
  )
    return "좋아하는 것은 100자 안으로 적어주세요.";
  return null;
}

export function parsePicturebookStoryGuide(
  value: unknown,
): PicturebookStoryGuide | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const guide = value as Record<string, unknown>;
  const hasText = (text: unknown, maxLength: number): text is string =>
    typeof text === "string" &&
    text.trim().length > 0 &&
    text.length <= maxLength;
  if (
    !hasText(guide.coreConflict, 600) ||
    !Array.isArray(guide.characters) ||
    guide.characters.length < 1 ||
    guide.characters.length > 6 ||
    !guide.characters.every(character => hasText(character, 100)) ||
    !hasText(guide.keyObject, 200) ||
    !hasText(guide.resolutionGoal, 600) ||
    !hasText(guide.visualStyle, 1200)
  )
    return null;
  return {
    coreConflict: guide.coreConflict,
    characters: guide.characters,
    keyObject: guide.keyObject,
    resolutionGoal: guide.resolutionGoal,
    visualStyle: guide.visualStyle,
  };
}

export function parsePicturebookDraft(
  rawText: string | null | undefined,
): PicturebookDraft | null {
  if (!rawText) return null;
  try {
    const book = JSON.parse(rawText);
    const storyGuide =
      book?.storyGuide === undefined
        ? undefined
        : parsePicturebookStoryGuide(book.storyGuide);
    const hasInvalidNotes = [
      book?.safetyNotes,
      book?.qualityNotes,
      book?.revisionNotes,
    ].some(
      notes =>
        notes !== undefined &&
        (!Array.isArray(notes) ||
          !notes.every(note => typeof note === "string")),
    );
    if (
      book?.kind !== "picturebook" ||
      !["choice-ready", "complete"].includes(book.status) ||
      typeof book.title !== "string" ||
      !book.title.trim() ||
      typeof book.childName !== "string" ||
      !book.childName.trim() ||
      typeof book.situation !== "string" ||
      !book.situation.trim() ||
      typeof book.lesson !== "string" ||
      !book.lesson.trim() ||
      !["calm", "playful", "brave"].includes(book.tone) ||
      !["3-4", "5-7", "8+"].includes(book.ageBand) ||
      storyGuide === null ||
      hasInvalidNotes ||
      !Array.isArray(book.pages) ||
      book.pages.length !== (book.status === "complete" ? 8 : 4) ||
      !book.pages.every(
        (page: PicturebookDraft["pages"][number], index: number) =>
          page &&
          page.pageNumber === index + 1 &&
          typeof page.textKo === "string" &&
          !!page.textKo.trim() &&
          typeof page.imagePrompt === "string",
      ) ||
      book.choice?.afterPage !== 4 ||
      typeof book.choice.promptKo !== "string" ||
      !book.choice.promptKo.trim() ||
      (book.selectedChoiceId !== undefined &&
        !["A", "B", "C"].includes(book.selectedChoiceId)) ||
      !Array.isArray(book.choice.options) ||
      book.choice.options.length !== 3 ||
      !book.choice.options.every(
        (
          option: PicturebookDraft["choice"]["options"][number],
          index: number,
        ) =>
          option &&
          option.id === ["A", "B", "C"][index] &&
          typeof option.labelKo === "string" &&
          !!option.labelKo.trim() &&
          typeof option.resolutionHint === "string" &&
          !!option.resolutionHint.trim(),
      )
    )
      return null;
    return {
      ...book,
      ...(storyGuide ? { storyGuide } : {}),
      safetyNotes: book.safetyNotes ?? [],
    } as PicturebookDraft;
  } catch {
    return null;
  }
}

export function spreadStart(
  index: number,
  desktop: boolean,
  pageCount: number,
) {
  const clamped = Math.max(0, Math.min(index, pageCount - 1));
  return desktop ? clamped - (clamped % 2) : clamped;
}
