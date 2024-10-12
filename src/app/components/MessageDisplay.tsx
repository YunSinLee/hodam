import { useState } from "react";
import { useHodamSpeech } from "@/services/actions/hodam-speech";

export default function MessageDisplay({
  messages,
  isShowEnglish,
}: {
  messages: { text: string; text_en: string }[];
  isShowEnglish: boolean;
}) {
  const [currentSpeakingText, setCurrentSpeakingText] = useState(""); // 추가: 현재 읽히고 있는 텍스트

  const { HodamSpeech, changeHodamSpeechSetting, setText, speak, stop } =
    useHodamSpeech();

  function readMessage(message: string, isKorean = true) {
    changeHodamSpeechSetting({
      lang: isKorean ? "ko-KR" : "en-US",
      rate: isKorean ? 0.8 : 0.5,
    });
    setText(message);

    if (window.speechSynthesis.speaking) {
      stop();
      setCurrentSpeakingText(""); // speaking 중이 아닐 때 현재 읽히고 있는 텍스트 초기화
    } else {
      speak();
      setCurrentSpeakingText(message); // speaking 중일 때 현재 읽히고 있는 텍스트 설정
    }

    HodamSpeech.addEventListener("end", () => {
      setCurrentSpeakingText(""); // 읽기가 끝나면 현재 읽히고 있는 텍스트 초기화
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4">
        {messages.map((message, index) => (
          <div className="flex flex-col gap-2" key={index}>
            <p
              className={`text-xl leading-8 clickable-layer ${
                currentSpeakingText === message.text ? "font-bold" : ""
              }`}
              onClick={() => readMessage(message.text)}
            >
              {message.text}
            </p>
            {isShowEnglish && (
              <p
                className={`text-xl leading-8 clickable-layer ${
                  currentSpeakingText === message.text_en ? "font-bold" : ""
                }`}
                onClick={() => readMessage(message.text_en, false)}
              >
                {message.text_en}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
