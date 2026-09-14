/* eslint-disable react/jsx-no-bind */
// Render branches are mutually exclusive; handlers are direct, unmemoized UI actions.

"use client";

import { useState } from "react";

import Link from "next/link";

import PicturebookViewer from "@/app/components/picturebook/PicturebookViewer";
import type {
  PicturebookChoiceOption,
  PicturebookDraft,
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
export default function SamplePage() {
  const [book, setBook] = useState(sample);
  function choose(id: PicturebookChoiceOption["id"]) {
    setBook({
      ...sample,
      status: "complete",
      selectedChoiceId: id,
      pages: [
        ...sample.pages,
        {
          pageNumber: 5,
          textKo: firstEnding[id],
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
      ],
    });
  }
  return (
    <div className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">로그인 없이 읽는 예시 이야기</p>
        <h1>한 장씩, 함께 읽어볼까요?</h1>
        <p>
          이 예시는 글과 선택 흐름을 보여드려요. 실제 그림책은 아이의 입력에
          맞춰 글과 그림을 생성해요.
        </p>
      </div>
      <PicturebookViewer
        createAnotherLabel="처음부터 다시 읽기"
        picturebook={book}
        selectedChoiceId={book.selectedChoiceId}
        onSelectChoice={choose}
        onCreateAnother={() => setBook(sample)}
      />
      <div className="text-center mt-8">
        <Link className="button-primary" href="/service">
          우리 아이 이야기로 만들기 ↗
        </Link>
      </div>
    </div>
  );
}
