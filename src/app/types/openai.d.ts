import type { User } from "./user";

export interface Thread {
  id: number;
  openai_thread_id: string;
  created_at: string;
  user_id: string;
  able_english: boolean;
  has_image: boolean;
}

export interface Keyword {
  id: number;
  thread_id: number;
  keyword: string;
}

export interface ThreadWithUser extends Thread {
  user: User;
  keywords: Keyword[];
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
export interface MessagePair {
  korean: string;
  english: string;
}

export interface StoryContent {
  rawText: string;
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
