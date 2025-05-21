import { ReactNode } from "react";

interface MessageDisplayProps {
  messages: {
    text: string;
    text_en: string;
  }[];
  isShowEnglish: boolean;
}

export default function MessageDisplay({
  messages,
  isShowEnglish,
}: MessageDisplayProps) {
  return (
    <div className="p-4 bg-white rounded-md shadow-sm transition-all">
      {messages.map((message, index) => (
        <div key={index} className="mb-4 last:mb-0">
          <p className="py-2 px-1 border-l-4 border-orange-500 text-gray-800">
            {message.text}
          </p>
          {isShowEnglish && message.text_en && (
            <p className="py-2 px-1 mt-1 border-l-4 border-blue-400 text-gray-600 italic">
              {message.text_en}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
