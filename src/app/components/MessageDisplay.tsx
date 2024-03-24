import { useHodamSpeech } from "@/services/actions/hodam-speech";

export default function MessageDisplay({
  messages,
  isShowEnglish,
}: {
  messages: { text: string; text_en: string }[];
  isShowEnglish: boolean;
}) {
  function readMessage(message: string) {
    const { setText, speak, stop } = useHodamSpeech();

    setText(message);

    if (window.speechSynthesis.speaking) {
      stop();
    } else {
      speak();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4">
        {messages.map((message, index) => (
          <div className="flex flex-col gap-2" key={index}>
            <p
              className="text-xl leading-8"
              onClick={() => readMessage(message.text)}
            >
              {message.text}
            </p>
            {isShowEnglish && (
              <p
                className="text-xl leading-8"
                onClick={() => readMessage(message.text_en)}
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
