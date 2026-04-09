"use client";

import { useEffect, useRef, useState } from "react";

import { TtsResponseSchema } from "@/app/api/v1/schemas";
import { authorizedFetch } from "@/lib/client/api/http";

import type {
  MessageDisplayHandlers,
  MessageDisplayState,
} from "./message-display-contract";

interface WindowWithWebkitAudioContext extends Window {
  webkitAudioContext?: typeof AudioContext;
}

export default function useMessageDisplayTtsController({
  useGoogleTTS = true,
  voice = "male",
}: {
  useGoogleTTS?: boolean;
  voice?: string;
}) {
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

  const playNextAudio = async (activeIndex: number) => {
    if (currentAudioIndexRef.current >= audioUrlsRef.current.length) {
      setPlayingIndex(null);
      return;
    }

    const audioUrl = audioUrlsRef.current[currentAudioIndexRef.current];

    const fallbackToDefaultAudio = () => {
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

    try {
      if (audioContextRef.current) {
        await audioContextRef.current.close().catch(() => undefined);
      }

      const AudioContextCtor =
        window.AudioContext ||
        (window as WindowWithWebkitAudioContext).webkitAudioContext;

      if (!AudioContextCtor) {
        fallbackToDefaultAudio();
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
      fallbackToDefaultAudio();
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

  const handlers: MessageDisplayHandlers = {
    onToggleControls: () => setShowControls(current => !current),
    onSpeedChange: value => setSpeed(value),
    onPitchChange: value => setPitch(value),
    onSpeak: (text: string, index: number, language: string = "ko-KR") => {
      if (useGoogleTTS) {
        speakTextWithGoogleTTS(
          text,
          index,
          language === "ko-KR" ? "ko" : "en-US",
        ).catch(() => undefined);
        return;
      }

      speakTextWithBrowser(text, index, language);
    },
    onStop: stopSpeaking,
  };

  const state: MessageDisplayState = {
    playingIndex,
    ttsErrorMessage,
    controls: {
      speed,
      pitch,
      showControls,
    },
  };

  return {
    state,
    handlers,
    audioRef,
  };
}
