import { useEffect, useId, useRef, useState } from "react";

import { requireAccessToken } from "@/app/utils/session";

interface MessageDisplayProps {
  messages: {
    text: string;
    text_en: string;
  }[];
  isShowEnglish: boolean;
  useGoogleTTS?: boolean; // Google TTS 사용 여부
  voice?: string; // 음성 타입 (male, female 등)
}

export default function MessageDisplay({
  messages,
  isShowEnglish,
  useGoogleTTS = true, // 기본값은 Google TTS API 사용
  voice = "male", // 기본값은 남성 목소리
}: MessageDisplayProps) {
  const messageId = useId();
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [speechError, setSpeechError] = useState("");
  const audioUrlsRef = useRef<string[]>([]);
  const currentAudioIndexRef = useRef<number>(0);

  // Web Audio API 관련 참조 추가
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  // 음성 설정 상태
  const [speed, setSpeed] = useState<number>(1.0); // 기본 속도
  const [pitch, setPitch] = useState<number>(1.0); // 기본 피치
  const [showControls, setShowControls] = useState<boolean>(false); // 컨트롤 표시 여부

  useEffect(() => {
    // 컴포넌트 언마운트 시 음성 재생 중지
    return () => {
      stopSpeaking();
    };
  }, [messages]);

  // 속도 변경 시 재생 중인 오디오에 적용
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  }, [speed]);

  // 브라우저 기본 TTS 기능 구현
  const speakTextWithBrowser = (
    text: string,
    index: number,
    language: string = "ko-KR",
  ) => {
    if (
      typeof window.speechSynthesis?.speak === "function" &&
      typeof window.SpeechSynthesisUtterance === "function"
    ) {
      utteranceRef.current = null;
      setSpeechError("");
      // 다른 음성이 재생 중이면 중지
      window.speechSynthesis.cancel();

      // 새 음성 생성
      const utterance = new SpeechSynthesisUtterance(text);
      utteranceRef.current = utterance;

      // 언어 설정 (한국어 또는 영어)
      utterance.lang = language;

      // 속도와 피치 설정
      utterance.rate = speed;
      utterance.pitch = pitch;

      // 목소리 선택 로직 추가
      try {
        if (window.speechSynthesis.getVoices().length > 0) {
          const voices = window.speechSynthesis.getVoices();
          const langCode = language.startsWith("ko") ? "ko" : "en";

          // 선호하는 성별에 따라 목소리 필터링
          const [preferredVoice] = voices.filter(
            v =>
              v.lang.includes(langCode) &&
              (voice === "female"
                ? v.name.toLowerCase().includes("female")
                : true),
          );

          // 적절한 목소리가 있으면 설정
          if (preferredVoice) {
            utterance.voice = preferredVoice;
          }
        }
      } catch {
        // Continue with the browser's default voice if voice discovery fails.
      }

      // 음성 재생 시작 설정
      setPlayingIndex(index);

      // 음성 재생 종료 시 상태 업데이트
      utterance.onend = () => {
        if (utteranceRef.current !== utterance) return;
        utteranceRef.current = null;
        setPlayingIndex(null);
      };
      utterance.onerror = () => {
        if (utteranceRef.current !== utterance) return;
        utteranceRef.current = null;
        setPlayingIndex(null);
        setSpeechError("소리를 재생하지 못했어요. 잠시 후 다시 눌러주세요.");
      };

      // 음성 재생
      try {
        window.speechSynthesis.speak(utterance);
      } catch {
        utteranceRef.current = null;
        setPlayingIndex(null);
        setSpeechError("이 기기에서 소리를 재생하지 못했어요.");
      }
    } else {
      setSpeechError("이 브라우저에서는 읽어주기를 사용할 수 없어요.");
    }
  };

  // Google Translate TTS API를 사용한 TTS 기능 구현
  const speakTextWithGoogleTTS = async (
    text: string,
    index: number,
    language: string = "ko",
  ) => {
    try {
      setPlayingIndex(index);

      // 기존 오디오 중지
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }

      // Google TTS API 호출
      const response = await fetch("/api/routes/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await requireAccessToken()}`,
        },
        body: JSON.stringify({
          text,
          language,
          pitch, // 피치 값 전달
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "TTS API 호출 실패");
      }

      // base64 인코딩된 오디오 데이터 배열 받기
      const { audioDataArray } = data;
      if (!audioDataArray || audioDataArray.length === 0) {
        throw new Error("오디오 데이터를 받지 못했습니다.");
      }

      // 오디오 URL 배열 생성
      audioUrlsRef.current = audioDataArray.map(
        (base64Data: string) => `data:${data.contentType};base64,${base64Data}`,
      );
      currentAudioIndexRef.current = 0;

      // 첫 번째 오디오 재생 시작
      playNextAudio();
    } catch {
      setPlayingIndex(null);

      // 오류 발생 시 브라우저 기본 TTS로 폴백
      speakTextWithBrowser(text, index, language === "ko" ? "ko-KR" : "en-US");
    }
  };

  // 다음 오디오 재생 함수
  const playNextAudio = () => {
    if (currentAudioIndexRef.current >= audioUrlsRef.current.length) {
      // 모든 오디오 재생 완료
      setPlayingIndex(null);
      return;
    }

    // 현재 오디오 URL 가져오기
    const audioUrl = audioUrlsRef.current[currentAudioIndexRef.current];

    try {
      // Web Audio API를 사용하여 피치 조정 구현
      // 기존 오디오 컨텍스트가 있으면 닫기
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {
          // The previous audio context may already have been closed.
        });
      }

      // 새 오디오 컨텍스트 생성
      const AudioContextConstructor =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextConstructor) {
        fallbackToDefaultAudio(audioUrl);
        return;
      }
      audioContextRef.current = new AudioContextConstructor();

      const request = new XMLHttpRequest();

      request.open("GET", audioUrl, true);
      request.responseType = "arraybuffer";

      request.onload = () => {
        if (!audioContextRef.current) return;

        audioContextRef.current.decodeAudioData(
          request.response,
          buffer => {
            if (!audioContextRef.current) return;

            // 이전 소스 노드가 있으면 중지
            if (sourceNodeRef.current) {
              try {
                sourceNodeRef.current.stop();
                sourceNodeRef.current.disconnect();
              } catch {
                // An already stopped source does not prevent the next segment.
              }
            }

            // 새 소스 노드 생성
            sourceNodeRef.current =
              audioContextRef.current.createBufferSource();
            sourceNodeRef.current.buffer = buffer;

            // 피치 변경을 위한 설정
            // 피치를 조정하면서 재생 속도는 유지하기 위한 계산
            sourceNodeRef.current.playbackRate.value = pitch;

            // AudioContext에 피치 처리를 위한 효과 추가
            const pitchEffect = audioContextRef.current.createBiquadFilter();
            pitchEffect.type = "allpass";
            pitchEffect.frequency.value = 350 * pitch;
            pitchEffect.Q.value = 1.0;

            // detune 값을 사용해 미세 조정
            sourceNodeRef.current.detune.value = (pitch - 1) * 200;

            // 속도 조정 (원래 속도 유지)
            if (Math.abs(pitch - 1.0) > 0.01) {
              // 피치와 속도의 독립적 조정
              sourceNodeRef.current.playbackRate.value = speed / pitch ** 0.8;
            } else {
              sourceNodeRef.current.playbackRate.value = speed;
            }

            // 오디오 처리 체인 연결
            sourceNodeRef.current.connect(pitchEffect);
            pitchEffect.connect(audioContextRef.current.destination);

            // 재생 시작
            sourceNodeRef.current.start(0);

            // 현재 오디오 재생 완료 후 다음 오디오 재생
            sourceNodeRef.current.onended = () => {
              currentAudioIndexRef.current++;
              playNextAudio();
            };
          },
          () => {
            // 오류 발생 시 기본 Audio 요소로 폴백
            fallbackToDefaultAudio(audioUrl);
          },
        );
      };

      request.onerror = () => {
        // 오류 발생 시 기본 Audio 요소로 폴백
        fallbackToDefaultAudio(audioUrl);
      };

      request.send();
    } catch {
      // Web Audio API를 지원하지 않는 브라우저는 기본 방식으로 폴백
      fallbackToDefaultAudio(audioUrl);
    }
  };

  // 기본 오디오 요소로 폴백
  const fallbackToDefaultAudio = (audioUrl: string) => {
    // 오디오 요소 생성 또는 업데이트
    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
    } else {
      audioRef.current.src = audioUrl;
    }

    // 오디오 속도 설정
    audioRef.current.playbackRate = speed;

    // 오디오 재생
    audioRef.current.play();

    // 현재 오디오 재생 완료 후 다음 오디오 재생
    audioRef.current.onended = () => {
      currentAudioIndexRef.current++;
      playNextAudio();
    };
  };

  // 음성 재생 중지
  const stopSpeaking = () => {
    utteranceRef.current = null;
    // Web Audio API 정지
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
        sourceNodeRef.current = null;
      } catch {
        // A source may already have stopped by the time cleanup runs.
      }
    }

    // AudioContext 정리
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close().catch(() => {
          // A closed context needs no further cleanup.
        });
        audioContextRef.current = null;
      } catch {
        // Closing an unavailable context must not interrupt speech cleanup.
      }
    }

    // 브라우저 기본 음성 합성 정지
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    // 기본 Audio 요소 정지
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    // 모든 상태 초기화
    audioUrlsRef.current = [];
    currentAudioIndexRef.current = 0;
    setPlayingIndex(null);
  };

  // 메인 음성 재생 함수 (설정에 따라 적절한 TTS 방식 선택)
  const speakText = (
    text: string,
    index: number,
    language: string = "ko-KR",
  ) => {
    if (useGoogleTTS) {
      // Google TTS API 사용
      speakTextWithGoogleTTS(
        text,
        index,
        language === "ko-KR" ? "ko" : "en-US",
      );
    } else {
      // 브라우저 기본 TTS 사용
      speakTextWithBrowser(text, index, language);
    }
  };

  // 컨트롤 토글 함수
  const toggleControls = () => {
    setShowControls(!showControls);
  };

  const occurrences = new Map<string, number>();
  const messageRows = messages.map(message => {
    const contentKey = JSON.stringify([message.text, message.text_en]);
    const occurrence = occurrences.get(contentKey) || 0;
    occurrences.set(contentKey, occurrence + 1);
    return { message, key: `${contentKey}:${occurrence}` };
  });

  return (
    <div className="p-4 bg-white rounded-md shadow-sm transition-all">
      {/* 오디오 설정 패널 */}
      <div className="mb-4">
        <button
          type="button"
          aria-expanded={showControls}
          onClick={toggleControls}
          className="text-sm text-orange-500 flex items-center mb-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 mr-1"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
              clipRule="evenodd"
            />
          </svg>
          읽어주기 설정 {showControls ? "숨기기" : "보기"}
        </button>

        {showControls && (
          <div className="bg-gray-50 p-3 rounded-md text-sm">
            <div className="mb-2">
              <label className="flex items-center justify-between">
                <span>읽는 속도: {speed.toFixed(1)}x</span>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={speed}
                  onChange={e => setSpeed(parseFloat(e.target.value))}
                  className="w-32 h-2 bg-orange-200 rounded-lg appearance-none cursor-pointer ml-2"
                />
              </label>
            </div>
            <div>
              <label className="flex items-center justify-between">
                <span>목소리 높이: {pitch.toFixed(1)}</span>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={pitch}
                  onChange={e => setPitch(parseFloat(e.target.value))}
                  className="w-32 h-2 bg-orange-200 rounded-lg appearance-none cursor-pointer ml-2"
                />
              </label>
            </div>
          </div>
        )}
      </div>

      {speechError && (
        <p className="notice-info mb-4" role="status">
          {speechError}
        </p>
      )}
      <p className="text-sm text-gray-600 mb-4">
        문장을 누르면 읽어줘요. 한 번 더 누르면 멈춰요.
      </p>
      {/* 숨겨진 오디오 요소 */}
      <audio ref={audioRef} style={{ display: "none" }} />

      {messageRows.map(({ message, key }, index) => (
        <div key={key} className="mb-4 last:mb-0">
          <button
            type="button"
            className="relative group w-full text-left"
            aria-label={`${index + 1}번째 문장 ${playingIndex === index ? "읽어주기 멈추기" : "읽어주기"}`}
            aria-pressed={playingIndex === index}
            aria-describedby={`${messageId}-ko-${index}`}
            onClick={() =>
              playingIndex === index
                ? stopSpeaking()
                : speakText(message.text, index, "ko-KR")
            }
          >
            <span
              className={`py-2 px-3 border-l-4 border-orange-500 text-gray-800 transition-all
                ${playingIndex === index ? "bg-orange-50" : "hover:bg-orange-50/50"}
                cursor-pointer rounded-r flex items-center`}
            >
              {/* 아이콘 표시 공간 고정 */}
              <span className="inline-block w-5 h-5 mr-2 flex-shrink-0 relative">
                {/* 재생 중 표시 아이콘 */}
                {playingIndex === index ? (
                  <span className="absolute inset-0 w-3 h-3">
                    <span className="absolute w-1 h-3 bg-orange-500 rounded-sm animate-sound-wave1" />
                    <span className="absolute w-1 h-3 bg-orange-500 rounded-sm left-1 animate-sound-wave2" />
                    <span className="absolute w-1 h-3 bg-orange-500 rounded-sm left-2 animate-sound-wave3" />
                  </span>
                ) : (
                  /* 호버 시 나타나는 스피커 아이콘 */
                  <span className="absolute inset-0 text-orange-500 opacity-0 group-hover:opacity-100 transition-opacity">
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

              {/* 문장 내용 */}
              <span id={`${messageId}-ko-${index}`} className="inline-block">
                {message.text}
              </span>
            </span>
          </button>

          {isShowEnglish && message.text_en && (
            <button
              type="button"
              className="relative group mt-1 w-full text-left"
              aria-label={`${index + 1}번째 영어 문장 ${playingIndex === index + 1000 ? "읽어주기 멈추기" : "읽어주기"}`}
              aria-pressed={playingIndex === index + 1000}
              aria-describedby={`${messageId}-en-${index}`}
              onClick={() =>
                playingIndex === index + 1000
                  ? stopSpeaking()
                  : speakText(message.text_en, index + 1000, "en-US")
              }
            >
              <span
                className={`py-2 px-3 border-l-4 border-blue-400 text-gray-600 italic transition-all
                  ${playingIndex === index + 1000 ? "bg-blue-50" : "hover:bg-blue-50/50"}
                  cursor-pointer rounded-r flex items-center`}
              >
                {/* 아이콘 표시 공간 고정 (영어) */}
                <span className="inline-block w-5 h-5 mr-2 flex-shrink-0 relative">
                  {/* 재생 중 표시 아이콘 (영어) */}
                  {playingIndex === index + 1000 ? (
                    <span className="absolute inset-0 w-3 h-3">
                      <span className="absolute w-1 h-3 bg-blue-400 rounded-sm animate-sound-wave1" />
                      <span className="absolute w-1 h-3 bg-blue-400 rounded-sm left-1 animate-sound-wave2" />
                      <span className="absolute w-1 h-3 bg-blue-400 rounded-sm left-2 animate-sound-wave3" />
                    </span>
                  ) : (
                    /* 호버 시 나타나는 스피커 아이콘 (영어) */
                    <span className="absolute inset-0 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
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

                {/* 문장 내용 (영어) */}
                <span id={`${messageId}-en-${index}`} className="inline-block">
                  {message.text_en}
                </span>
              </span>
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
