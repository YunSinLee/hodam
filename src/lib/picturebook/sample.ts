import type {
  PicturebookDraft,
  PicturebookChoiceOption,
} from "@/app/types/openai";

const sample: PicturebookDraft = {
  kind: "picturebook",
  status: "choice-ready",
  title: "작은 용기를 빌려줄게",
  childName: "민준",
  ageBand: "5-7",
  situation: "처음 가는 유치원 앞에서 엄마 손을 꼭 잡았어요.",
  lesson: "천천히 다가가도 괜찮다는 마음",
  tone: "calm",
  createdAt: "2026-09-14T00:00:00Z",
  safetyNotes: [],
  pages: [
    {
      pageNumber: 1,
      textKo:
        "노란 문 앞에서 민준이의 발끝이 멈췄어요. 엄마 손이 따뜻했지만, 손가락은 더 꼭 말렸어요.",
      imagePrompt: "",
      emotionalBeat: "setup",
    },
    {
      pageNumber: 2,
      textKo:
        "문 안에서는 작은 웃음소리가 흘러나왔어요. 민준이는 운동화에 그려진 별을 내려다봤어요. 별도 조금 떨리는 것 같았어요.",
      imagePrompt: "",
      emotionalBeat: "tension",
    },
    {
      pageNumber: 3,
      textKo:
        "그때 주머니 속 호랑이 인형이 손끝에 닿았어요. ‘내 작은 용기를 빌려줄게.’ 민준이는 인형의 동그란 귀를 살며시 만졌어요.",
      imagePrompt: "",
      emotionalBeat: "setup",
    },
    {
      pageNumber: 4,
      textKo:
        "노란 문이 조금 열렸어요. 안쪽에서 누군가 작은 손을 흔들었어요. 민준이의 손가락 하나가 천천히 펴졌어요.",
      imagePrompt: "",
      emotionalBeat: "choice",
    },
  ],
  choice: {
    afterPage: 4,
    promptKo: "민준이는 어떤 작은 용기를 내볼까요?",
    options: [
      {
        id: "A",
        labelKo: "친구에게 작은 손을 흔들어요",
        resolutionHint: "손을 흔들며 인사하기",
      },
      {
        id: "B",
        labelKo: "엄마와 함께 한 걸음 다가가요",
        resolutionHint: "어른과 작은 걸음",
      },
      {
        id: "C",
        labelKo: "호랑이 인형을 친구에게 보여줘요",
        resolutionHint: "인형으로 마음 열기",
      },
    ],
  },
};
const firstEnding = {
  A: "민준이는 배꼽 높이에서 손을 살짝 흔들었어요. 문 안의 친구도 똑같이 손을 흔들었어요. 두 손 사이로 웃음이 건너왔어요.",
  B: "엄마와 나란히 한 걸음 옮겼어요. 문틈으로 비누 냄새가 살짝 흘러왔어요. 민준이는 엄마 손을 조금 느슨하게 잡았어요.",
  C: "민준이는 주머니에서 호랑이를 꺼냈어요. ‘우리 집에도 토끼가 있어.’ 친구가 인형의 귀를 보고 웃었어요.",
};

export function normalizeSampleName(value: string): string {
  return (
    value
      // Strip control characters from a user-visible nickname.
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .trim()
      .slice(0, 20) || "민준"
  );
}

export function createSampleBook(
  name = "민준",
  choice?: PicturebookChoiceOption["id"],
): PicturebookDraft {
  const childName = normalizeSampleName(name);
  const last = childName.charCodeAt(childName.length - 1);
  const named =
    childName +
    (last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 !== 0
      ? "이"
      : "");
  const personalize = (text: string) => text.replaceAll("민준이", () => named);
  const ending: PicturebookDraft["pages"] = choice
    ? [
        {
          pageNumber: 5,
          textKo: firstEnding[choice],
          imagePrompt: "",
          emotionalBeat: "resolution",
        },
        {
          pageNumber: 6,
          textKo:
            "신발을 벗으려는데 마음이 다시 콩닥거렸어요. 민준이는 주머니 위에 손을 얹고 숨을 한 번 길게 쉬었어요.",
          imagePrompt: "",
          emotionalBeat: "tension",
        },
        {
          pageNumber: 7,
          textKo:
            "친구가 옆자리를 톡톡 두드렸어요. 민준이는 그 자리에 앉아 노란 블록을 하나 올렸어요. 작은 탑 위로 햇살이 내려앉았어요.",
          imagePrompt: "",
          emotionalBeat: "resolution",
        },
        {
          pageNumber: 8,
          textKo:
            "밤이 되자 호랑이는 베개 옆에 누웠어요. ‘내일도 같이 가자.’ 민준이는 작은 귀를 덮어주고, 이불 안으로 쏙 들어갔어요.",
          imagePrompt: "",
          emotionalBeat: "calm-close",
        },
      ]
    : [];
  return {
    ...sample,
    childName,
    status: choice ? "complete" : "choice-ready",
    selectedChoiceId: choice,
    pages: [...sample.pages, ...ending].map(page => ({
      ...page,
      textKo: personalize(page.textKo),
    })),
    choice: { ...sample.choice, promptKo: personalize(sample.choice.promptKo) },
  };
}

// A deliberate sample CTA carries only this tab's transient input. Nothing is
// put in a URL or persistent browser storage; a reload safely drops the hint.
let starter: { name: string; expiresAt: number } | null = null;
export function prepareSampleStarter(name: string) {
  starter = {
    name: normalizeSampleName(name),
    expiresAt: Date.now() + 15 * 60_000,
  };
}
export function consumeSampleStarter() {
  const saved = starter;
  starter = null;
  return saved && saved.expiresAt > Date.now()
    ? {
        childName: saved.name,
        situation: sample.situation,
        lesson: sample.lesson,
      }
    : null;
}
