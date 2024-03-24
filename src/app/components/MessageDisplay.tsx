import { useHodamSpeech } from "@/services/actions/hodam-speech";

export default function MessageDisplay({
  messages,
}: {
  messages: { text: string }[];
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
      {messages.map((message, index) => (
        <p
          className="text-xl leading-8"
          key={index}
          onClick={() => readMessage(message.text)}
        >
          {message.text}
        </p>
      ))}
    </div>
  );
}
