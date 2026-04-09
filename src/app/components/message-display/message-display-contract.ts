export interface StoryMessage {
  text: string;
  text_en: string;
}

export interface MessageDisplayProps {
  messages: StoryMessage[];
  isShowEnglish: boolean;
  useGoogleTTS?: boolean;
  voice?: string;
}

export interface MessageDisplayControlsState {
  speed: number;
  pitch: number;
  showControls: boolean;
}

export interface MessageDisplayState {
  playingIndex: number | null;
  ttsErrorMessage: string | null;
  controls: MessageDisplayControlsState;
}

export interface MessageDisplayHandlers {
  onToggleControls: () => void;
  onSpeedChange: (value: number) => void;
  onPitchChange: (value: number) => void;
  onSpeak: (text: string, index: number, language?: string) => void;
  onStop: () => void;
}

export interface KeyedStoryMessage {
  key: string;
  message: StoryMessage;
}
