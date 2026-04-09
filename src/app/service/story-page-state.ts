import { normalizeStoryKeywords } from "@/lib/story/options";

export interface StoryMessageViewModel {
  text: string;
  text_en: string;
  [key: string]: unknown;
}

export interface StorySelectionViewModel {
  text: string;
  text_en: string;
  [key: string]: unknown;
}

export interface StartStoryResponseLike {
  threadId: number;
  messages?: StoryMessageViewModel[];
  selections?: StorySelectionViewModel[];
  notice?: string;
  imageUrl?: string | null;
  includeEnglish?: boolean;
  beadCount: number;
}

export interface ContinueStoryResponseLike {
  messages?: StoryMessageViewModel[];
  selections?: StorySelectionViewModel[];
  notice?: string;
  beadCount: number;
}

export interface TranslateStoryResponseLike {
  messages?: StoryMessageViewModel[];
  beadCount: number;
}

export interface StartStoryStatePatch {
  threadId: number;
  messages: StoryMessageViewModel[];
  selections: StorySelectionViewModel[];
  notice: string;
  images: string[];
  shouldShowEnglish: boolean;
  beadCount: number;
}

export interface ContinueStoryStatePatch {
  incomingMessages: StoryMessageViewModel[];
  selections: StorySelectionViewModel[];
  notice: string;
  beadCount: number;
}

export interface TranslateStoryStatePatch {
  translatedMessages: StoryMessageViewModel[];
  beadCount: number;
  isShowEnglish: true;
  isEnglishIncluded: true;
}

export function buildStartStoryKeywordsPayload(
  rawKeywords: string,
): string | null {
  const normalizedKeywords = normalizeStoryKeywords(rawKeywords);
  if (normalizedKeywords.length === 0) {
    return null;
  }

  return normalizedKeywords.join(", ");
}

export function appendStoryMessages(
  current: StoryMessageViewModel[],
  incoming: StoryMessageViewModel[],
): StoryMessageViewModel[] {
  return [...current, ...incoming];
}

export function mergeTranslatedStoryMessages(
  current: StoryMessageViewModel[],
  translated: StoryMessageViewModel[],
): StoryMessageViewModel[] {
  return current.map((message, index) => ({
    ...message,
    text_en: translated[index]?.text_en || message.text_en,
  }));
}

export function toStartStoryStatePatch(
  response: StartStoryResponseLike,
): StartStoryStatePatch {
  return {
    threadId: response.threadId,
    messages: response.messages || [],
    selections: response.selections || [],
    notice: response.notice || "",
    images: response.imageUrl ? [response.imageUrl] : [],
    shouldShowEnglish: Boolean(response.includeEnglish),
    beadCount: response.beadCount,
  };
}

export function toContinueStoryStatePatch(
  response: ContinueStoryResponseLike,
): ContinueStoryStatePatch {
  return {
    incomingMessages: response.messages || [],
    selections: response.selections || [],
    notice: response.notice || "",
    beadCount: response.beadCount,
  };
}

export function toTranslateStoryStatePatch(
  response: TranslateStoryResponseLike,
): TranslateStoryStatePatch {
  return {
    translatedMessages: response.messages || [],
    beadCount: response.beadCount,
    isShowEnglish: true,
    isEnglishIncluded: true,
  };
}
