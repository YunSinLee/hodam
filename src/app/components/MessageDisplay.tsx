import { useMemo } from "react";

import type {
  KeyedStoryMessage,
  MessageDisplayProps,
} from "@/app/components/message-display/message-display-contract";
import MessageDisplayControls from "@/app/components/message-display/MessageDisplayControls";
import MessageDisplayLineItem from "@/app/components/message-display/MessageDisplayLineItem";
import useMessageDisplayTtsController from "@/app/components/message-display/useMessageDisplayTtsController";

const ENGLISH_INDEX_OFFSET = 1000;

function toKeyedMessages(messages: MessageDisplayProps["messages"]) {
  const seen = new Map<string, number>();

  return messages.map(message => {
    const baseKey = `${message.text}::${message.text_en}`;
    const nextCount = (seen.get(baseKey) || 0) + 1;
    seen.set(baseKey, nextCount);

    return {
      key: `${baseKey}::${nextCount}`,
      message,
    } satisfies KeyedStoryMessage;
  });
}

export default function MessageDisplay({
  messages,
  isShowEnglish,
  useGoogleTTS = true,
  voice = "male",
}: MessageDisplayProps) {
  const { state, handlers, audioRef } = useMessageDisplayTtsController({
    useGoogleTTS,
    voice,
  });
  const keyedMessages = useMemo(() => toKeyedMessages(messages), [messages]);

  return (
    <div className="rounded-md bg-white p-4 shadow-sm transition-all">
      {state.ttsErrorMessage && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.ttsErrorMessage}
        </div>
      )}

      <MessageDisplayControls
        state={state.controls}
        handlers={{
          onToggleControls: handlers.onToggleControls,
          onSpeedChange: handlers.onSpeedChange,
          onPitchChange: handlers.onPitchChange,
        }}
      />

      <audio ref={audioRef} style={{ display: "none" }} />

      {keyedMessages.map(({ key, message }, index) => {
        const englishIndex = index + ENGLISH_INDEX_OFFSET;

        return (
          <div key={key} className="mb-4 last:mb-0">
            <MessageDisplayLineItem
              text={message.text}
              variant="ko"
              isPlaying={state.playingIndex === index}
              onClick={() =>
                state.playingIndex === index
                  ? handlers.onStop()
                  : handlers.onSpeak(message.text, index, "ko-KR")
              }
            />

            {isShowEnglish && message.text_en && (
              <div className="mt-1">
                <MessageDisplayLineItem
                  text={message.text_en}
                  variant="en"
                  isPlaying={state.playingIndex === englishIndex}
                  onClick={() =>
                    state.playingIndex === englishIndex
                      ? handlers.onStop()
                      : handlers.onSpeak(message.text_en, englishIndex, "en-US")
                  }
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
