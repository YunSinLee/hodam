"use client";

import { useHodamSpeech } from "@/services/actions/hodam-speech";
import { useEffect } from "react";

export default async function Hodam() {
  const handleClick = async () => {
    const { setText, speak } = useHodamSpeech();

    await setText("다음 날, 윤신은 숲 가장자리에 예쁜 카페를 열었어요.");
    speak();
  };

  return (
    <div>
      <button onClick={handleClick}>클릭</button>
    </div>
  );
}
