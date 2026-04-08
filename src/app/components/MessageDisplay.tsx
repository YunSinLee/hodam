import { useEffect, useMemo, useRef, useState } from "react";

import { TtsResponseSchema } from "@/app/api/v1/schemas";
import { authorizedFetch } from "@/lib/client/api/http";

interface StoryMessage {
  text: string;
  text_en: string;
}

interface MessageDisplayProps {
  messages: StoryMessage[];
  isShowEnglish: boolean;
  useGoogleTTS?: boolean;
  voice?: string;
}

interface WindowWithWebkitAudioContext extends Window {
  webkitAudioContext?: typeof AudioContext;
}

const ENGLISH_INDEX_OFFSET = 1000;

export default function MessageDisplay({
  messages,
  isShowEnglish,
  useGoogleTTS = true,
  voice = "male",
}: MessageDisplayProps) {
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [ttsErrorMessage, setTtsErrorMessage] = useState<string | null>(null);
  const [speed, setSpeed] = useState<number>(1.0);
  const [pitch, setPitch] = useState<number>(1.0);
  const [showControls, setShowControls] = useState<boolean>(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlsRef = useRef<string[]>([]);
  const currentAudioIndexRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  const keyedMessages = useMemo(() => {
    const seen = new Map<string, number>();

    return messages.map(message => {
      const baseKey = `${message.text}::${message.text_en}`;
      const nextCount = (seen.get(baseKey) || 0) + 1;
      seen.set(baseKey, nextCount);

      return {
        key: `${baseKey}::${nextCount}`,
        message,
      };
    });
  }, [messages]);

  const stopSpeaking = () => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch {
        // Ignore stop/disconnect errors during cleanup.
      } finally {
        sourceNodeRef.current = null;
      }
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    audioUrlsRef.current = [];
    currentAudioIndexRef.current = 0;
    setPlayingIndex(null);
  };

  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  }, [speed]);

  const fallbackToDefaultAudio = (audioUrl: string, activeIndex: number) => {
    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
    } else {
      audioRef.current.src = audioUrl;
    }

    audioRef.current.playbackRate = speed;
    audioRef.current.onended = () => {
      currentAudioIndexRef.current += 1;
      playNextAudio(activeIndex).catch(() => undefined);
    };

    audioRef.current.play().catch(() => {
      setPlayingIndex(null);
      setTtsErrorMessage("오디오를 재생할 수 없습니다.");
    });
  };

  const playNextAudio = async (activeIndex: number) => {
    if (currentAudioIndexRef.current >= audioUrlsRef.current.length) {
      setPlayingIndex(null);
      return;
    }

    const audioUrl = audioUrlsRef.current[currentAudioIndexRef.current];

    try {
      if (audioContextRef.current) {
        await audioContextRef.current.close().catch(() => undefined);
      }

      const AudioContextCtor =
        window.AudioContext ||
        (window as WindowWithWebkitAudioContext).webkitAudioContext;

      if (!AudioContextCtor) {
        fallbackToDefaultAudio(audioUrl, activeIndex);
        return;
      }

      audioContextRef.current = new AudioContextCtor();
      const response = await fetch(audioUrl);
      if (!response.ok) {
        throw new Error(`Audio fetch failed: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContextRef.current.decodeAudioData(
        arrayBuffer.slice(0),
      );

      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.stop();
          sourceNodeRef.current.disconnect();
        } catch {
          // Ignore cleanup error and continue with current playback request.
        }
      }

      sourceNodeRef.current = audioContextRef.current.createBufferSource();
      sourceNodeRef.current.buffer = audioBuffer;

      const pitchEffect = audioContextRef.current.createBiquadFilter();
      pitchEffect.type = "allpass";
      pitchEffect.frequency.value = 350 * pitch;
      pitchEffect.Q.value = 1.0;

      sourceNodeRef.current.detune.value = (pitch - 1) * 200;
      sourceNodeRef.current.playbackRate.value =
        Math.abs(pitch - 1.0) > 0.01 ? speed / pitch ** 0.8 : speed;

      sourceNodeRef.current.connect(pitchEffect);
      pitchEffect.connect(audioContextRef.current.destination);
      sourceNodeRef.current.start(0);

      sourceNodeRef.current.onended = () => {
        currentAudioIndexRef.current += 1;
        playNextAudio(activeIndex).catch(() => undefined);
      };
    } catch {
      fallbackToDefaultAudio(audioUrl, activeIndex);
    }
  };

  const speakTextWithBrowser = (
    text: string,
    index: number,
    language: string = "ko-KR",
  ) => {
    setTtsErrorMessage(null);

    if (!("speechSynthesis" in window)) {
      setTtsErrorMessage("이 브라우저는 음성 합성을 지원하지 않습니다.");
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    utterance.rate = speed;
    utterance.pitch = pitch;

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      const langCode = language.startsWith("ko") ? "ko" : "en";
      const preferredVoices = voices.filter(candidate => {
        const isSameLanguage = candidate.lang.includes(langCode);
        if (!isSameLanguage) return false;
        if (voice === "female") {
          return candidate.name.toLowerCase().includes("female");
        }
        return true;
      });

      const [preferredVoice] = preferredVoices;
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
    }

    setPlayingIndex(index);
    utterance.onend = () => {
      setPlayingIndex(null);
    };
    utterance.onerror = () => {
      setPlayingIndex(null);
      setTtsErrorMessage("브라우저 음성 합성 재생 중 오류가 발생했습니다.");
    };
    window.speechSynthesis.speak(utterance);
  };

  const speakTextWithGoogleTTS = async (
    text: string,
    index: number,
    language: string = "ko",
  ) => {
    setTtsErrorMessage(null);
    setPlayingIndex(index);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }

    try {
      const data = await authorizedFetch<{
        audioDataArray: string[];
        contentType: string;
      }>(
        "/api/v1/tts",
        {
          method: "POST",
          body: JSON.stringify({
            text,
            language,
            pitch,
          }),
        },
        TtsResponseSchema,
      );

      const { audioDataArray } = data;
      if (!audioDataArray || audioDataArray.length === 0) {
        throw new Error("No audio data");
      }

      audioUrlsRef.current = audioDataArray.map(
        base64Data => `data:${data.contentType};base64,${base64Data}`,
      );
      currentAudioIndexRef.current = 0;

      await playNextAudio(index);
    } catch {
      setPlayingIndex(null);
      setTtsErrorMessage(
        "음성 생성 중 오류가 발생해 브라우저 음성으로 전환합니다.",
      );
      speakTextWithBrowser(text, index, language === "ko" ? "ko-KR" : "en-US");
    }
  };

  const speakText = (
    text: string,
    index: number,
    language: string = "ko-KR",
  ) => {
    if (useGoogleTTS) {
      speakTextWithGoogleTTS(
        text,
        index,
        language === "ko-KR" ? "ko" : "en-US",
      ).catch(() => undefined);
      return;
    }

    speakTextWithBrowser(text, index, language);
  };

  return (
    <div className="rounded-2xl border border-[#ef8d3d]/18 bg-white/80 p-4 shadow-[0_10px_24px_rgba(181,94,23,0.08)] transition-all">
      {ttsErrorMessage && (
        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {ttsErrorMessage}
        </div>
      )}

      <div className="mb-4">
        <button
          type="button"
          onClick={() => setShowControls(current => !current)}
          className="mb-2 flex items-center rounded-full border border-[#ef8d3d]/25 bg-[#fff8ef] px-3 py-1 text-xs font-semibold text-[#a25a1d] transition hover:border-[#ef8d3d]/45"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="mr-1 h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
              clipRule="evenodd"
            />
          </svg>
          TTS 설정 {showControls ? "숨기기" : "보기"}
        </button>

        {showControls && (
          <div className="rounded-xl border border-[#ef8d3d]/18 bg-[#fffaf4] p-3 text-sm">
            <div className="mb-2">
              <label className="flex items-center justify-between">
                <span>음성 속도: {speed.toFixed(1)}x</span>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={speed}
                  onChange={event => setSpeed(Number(event.target.value))}
                  className="ml-2 h-2 w-32 cursor-pointer appearance-none rounded-lg bg-orange-200"
                />
              </label>
            </div>
            <div>
              <label className="flex items-center justify-between">
                <span>음성 피치: {pitch.toFixed(1)}</span>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={pitch}
                  onChange={event => setPitch(Number(event.target.value))}
                  className="ml-2 h-2 w-32 cursor-pointer appearance-none rounded-lg bg-orange-200"
                />
              </label>
            </div>
          </div>
        )}
      </div>

      <audio ref={audioRef} style={{ display: "none" }} />

      {keyedMessages.map(({ key, message }, index) => (
        <div key={key} className="mb-3 last:mb-0">
          <button
            type="button"
            className={`group relative flex w-full items-start gap-2 rounded-r-xl border-l-4 px-3 py-2 text-left transition-all ${
              playingIndex === index
                ? "border-[#ef8d3d] bg-[#fff3e5]"
                : "border-[#ef8d3d] bg-[#fffdf9] hover:bg-[#fff7ee]"
            }`}
            onClick={() =>
              playingIndex === index
                ? stopSpeaking()
                : speakText(message.text, index, "ko-KR")
            }
            aria-label={
              playingIndex === index
                ? "한국어 음성 재생 중지"
                : "한국어 음성 재생"
            }
          >
            <span className="relative mt-0.5 inline-block h-5 w-5 flex-shrink-0">
              {playingIndex === index ? (
                <span className="absolute inset-0 h-3 w-3">
                  <span className="absolute h-3 w-1 animate-sound-wave1 rounded-sm bg-orange-500" />
                  <span className="absolute left-1 h-3 w-1 animate-sound-wave2 rounded-sm bg-orange-500" />
                  <span className="absolute left-2 h-3 w-1 animate-sound-wave3 rounded-sm bg-orange-500" />
                </span>
              ) : (
                <span className="absolute inset-0 text-orange-500 opacity-70 transition-opacity group-hover:opacity-100">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
              )}
            </span>
            <span className="inline-block text-sm text-gray-800 sm:text-base">
              {message.text}
            </span>
          </button>

          {isShowEnglish && message.text_en && (
            <button
              type="button"
              className={`group relative mt-1 flex w-full items-start gap-2 rounded-r-xl border-l-4 px-3 py-2 text-left transition-all ${
                playingIndex === index + ENGLISH_INDEX_OFFSET
                  ? "border-blue-400 bg-blue-50/80"
                  : "border-blue-300 bg-blue-50/40 hover:bg-blue-50/70"
              }`}
              onClick={() =>
                playingIndex === index + ENGLISH_INDEX_OFFSET
                  ? stopSpeaking()
                  : speakText(
                      message.text_en,
                      index + ENGLISH_INDEX_OFFSET,
                      "en-US",
                    )
              }
              aria-label={
                playingIndex === index + ENGLISH_INDEX_OFFSET
                  ? "영어 음성 재생 중지"
                  : "영어 음성 재생"
              }
            >
              <span className="relative mt-0.5 inline-block h-5 w-5 flex-shrink-0">
                {playingIndex === index + ENGLISH_INDEX_OFFSET ? (
                  <span className="absolute inset-0 h-3 w-3">
                    <span className="absolute h-3 w-1 animate-sound-wave1 rounded-sm bg-blue-500" />
                    <span className="absolute left-1 h-3 w-1 animate-sound-wave2 rounded-sm bg-blue-500" />
                    <span className="absolute left-2 h-3 w-1 animate-sound-wave3 rounded-sm bg-blue-500" />
                  </span>
                ) : (
                  <span className="absolute inset-0 text-blue-500 opacity-70 transition-opacity group-hover:opacity-100">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                )}
              </span>
              <span className="inline-block text-sm italic text-gray-700 sm:text-base">
                {message.text_en}
              </span>
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
