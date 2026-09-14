import type {
  PicturebookDraft,
  PicturebookInput,
} from "../src/app/types/openai";

export const input: PicturebookInput = {
  childName: "민준",
  childAge: "5",
  situation: "유치원에 가기 무서웠어요.",
  lesson: "천천히 해도 괜찮다는 마음",
  tone: "calm",
  interests: "호랑이",
};
export function book(
  status: "choice-ready" | "complete" = "choice-ready",
): PicturebookDraft {
  return {
    kind: "picturebook",
    status,
    title: "작은 용기",
    ...input,
    ageBand: "5-7",
    createdAt: "2026-09-14T00:00:00Z",
    safetyNotes: [],
    pages: Array.from(
      { length: status === "complete" ? 8 : 4 },
      (_, index) => ({
        pageNumber: index + 1,
        textKo: `${index + 1}쪽 이야기예요. 작은 손을 내밀었어요.`,
        imagePrompt: "Cozy bedtime scene",
        emotionalBeat: "setup" as const,
      }),
    ),
    choice: {
      afterPage: 4,
      promptKo: "어떻게 해볼까요?",
      options: [
        { id: "A", labelKo: "친구에게 손을 흔들어요", resolutionHint: "인사" },
        {
          id: "B",
          labelKo: "엄마 손을 잡고 다가가요",
          resolutionHint: "한 걸음",
        },
        {
          id: "C",
          labelKo: "인형을 친구에게 보여줘요",
          resolutionHint: "친구",
        },
      ],
    },
  };
}
