export interface Thread {
  id: number;
  openai_thread_id: string;
  created_at: string;
}

export interface Message {
  id: number;
  thread_id: number;
  created_at: string;
  turn: number;
  message: string;
  message_en: string;
  position: number;
}

export interface Selection {
  id: number;
  thread_id: number;
  created_at: string;
  turn: number;
  selection: string;
  selection_en: string;
}

export interface Keyword {
  id: number;
  thread_id: number;
  keyword: string;
}

export interface MessagePair {
  korean: string;
  english: string;
}

export interface StoryContent {
  messages: MessagePair[];
  selections: MessagePair[];
  notice: string;
  imageDescription: string;
}

export interface Image {
  id: number;
  image_url: string;
  thread_id: number;
  turn: number;
  description: string;
  created_at: string;
}
