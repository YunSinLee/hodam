import type { User } from "./user";

export interface Thread {
  id: number;
  openai_thread_id: string;
  created_at: string;
  user_id: string;
  able_english: boolean;
  has_image: boolean;
  raw_text?: string | null;
}

export interface ThreadWithUser extends Thread {
  user: User;
  keywords: Keyword[];
  messages?: Message[];
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

export type PicturebookTone = "calm" | "playful" | "brave";

export type PicturebookStatus = "choice-ready" | "complete";

export type PicturebookEmotionalBeat =
  | "setup"
  | "tension"
  | "choice"
  | "resolution"
  | "calm-close";

export interface PicturebookInput {
  childName: string;
  childAge: string;
  situation: string;
  lesson: string;
  tone: PicturebookTone;
  interests?: string;
}

export interface PicturebookPage {
  pageNumber: number;
  textKo: string;
  imagePrompt: string;
  emotionalBeat: PicturebookEmotionalBeat;
}

export interface PicturebookChoiceOption {
  id: "A" | "B" | "C";
  labelKo: string;
  resolutionHint: string;
}

export interface PicturebookChoice {
  afterPage: number;
  promptKo: string;
  options: PicturebookChoiceOption[];
}

export interface PicturebookDraft {
  kind: "picturebook";
  status: PicturebookStatus;
  title: string;
  childName: string;
  ageBand: "3-4" | "5-7" | "8+";
  situation: string;
  lesson: string;
  tone: PicturebookTone;
  interests?: string;
  pages: PicturebookPage[];
  choice: PicturebookChoice;
  selectedChoiceId?: "A" | "B" | "C";
  safetyNotes: string[];
  qualityNotes?: string[];
  revisionNotes?: string[];
  createdAt: string;
  completedAt?: string;
}
