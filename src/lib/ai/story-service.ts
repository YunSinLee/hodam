import OpenAI from "openai";

import { getOptionalEnv, getRequiredEnv } from "@/lib/env";

export interface StoryTurnResult {
  paragraphs: string[];
  notice: string;
  choices: string[];
  paragraphsEn: string[];
  choicesEn: string[];
  imagePrompt: string;
}

interface StoryTurnInput {
  keywords?: string[];
  storyContext?: string;
  userSelection?: string;
  includeEnglish: boolean;
}

const STORY_MODEL = "gpt-4o-mini";
const IMAGE_MODEL = "dall-e-3";
const STORY_RESPONSE_SCHEMA = {
  name: "hodam_story_turn",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "paragraphs",
      "notice",
      "choices",
      "paragraphsEn",
      "choicesEn",
      "imagePrompt",
    ],
    properties: {
      paragraphs: {
        type: "array",
        minItems: 1,
        items: { type: "string" },
      },
      notice: { type: "string" },
      choices: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: { type: "string" },
      },
      paragraphsEn: {
        type: "array",
        items: { type: "string" },
      },
      choicesEn: {
        type: "array",
        items: { type: "string" },
      },
      imagePrompt: { type: "string" },
    },
  },
} as const;

const TRANSLATION_RESPONSE_SCHEMA = {
  name: "hodam_translation",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["paragraphsEn"],
    properties: {
      paragraphsEn: {
        type: "array",
        items: { type: "string" },
      },
    },
  },
} as const;

export class AiServiceConfigurationError extends Error {
  constructor(message = "OPENAI_API_KEY is not configured") {
    super(message);
    this.name = "AiServiceConfigurationError";
  }
}

function getOpenAiApiKey() {
  const apiKey =
    getOptionalEnv("OPENAI_API_KEY") || getOptionalEnv("OPEN_AI_API_KEY");
  if (apiKey) return apiKey;

  try {
    // Keep backward-compatibility with legacy env key checks while preserving
    // a stable error type for route-level handling.
    return getRequiredEnv("OPEN_AI_API_KEY");
  } catch {
    throw new AiServiceConfigurationError();
  }
}

let openAiClient: OpenAI | null = null;

function getClient() {
  if (openAiClient) return openAiClient;

  openAiClient = new OpenAI({
    apiKey: getOpenAiApiKey(),
    timeout: 30_000,
    maxRetries: 2,
  });

  return openAiClient;
}

function normalizeStringList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map(item => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function sanitizeStoryTurn(payload: unknown): StoryTurnResult {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid model response payload");
  }

  const raw = payload as Record<string, unknown>;
  const paragraphs = normalizeStringList(raw.paragraphs);
  const choices = normalizeStringList(raw.choices);

  if (paragraphs.length === 0 || choices.length !== 3) {
    throw new Error("Model response did not include required story fields");
  }

  return {
    paragraphs,
    notice:
      typeof raw.notice === "string" && raw.notice.trim().length > 0
        ? raw.notice.trim()
        : "다음 전개를 선택해 이야기를 이어가세요.",
    choices,
    paragraphsEn: normalizeStringList(raw.paragraphsEn),
    choicesEn: normalizeStringList(raw.choicesEn),
    imagePrompt:
      typeof raw.imagePrompt === "string" && raw.imagePrompt.trim().length > 0
        ? raw.imagePrompt.trim()
        : "A warm, colorful Korean children's storybook illustration, simple and friendly composition.",
  };
}

export async function generateStoryTurn(
  input: StoryTurnInput,
): Promise<StoryTurnResult> {
  const client = getClient();

  const systemPrompt = [
    "You are HODAM, a Korean children's storyteller AI.",
    "You must produce ONLY valid JSON.",
    "The story must be safe for children, warm, and educational.",
    "Provide exactly 3 distinct choices:",
    "1) brave/active, 2) thoughtful/wise, 3) creative/unique.",
  ].join(" ");

  const userPrompt = {
    task: input.storyContext ? "continue_story" : "start_story",
    language: "ko",
    includeEnglish: input.includeEnglish,
    keywords: input.keywords ?? [],
    storyContext: input.storyContext ?? "",
    userSelection: input.userSelection ?? "",
    outputSchema: {
      paragraphs: ["korean paragraph 1", "korean paragraph 2"],
      notice: "korean notice",
      choices: ["korean choice 1", "korean choice 2", "korean choice 3"],
      paragraphsEn: ["english paragraph 1", "english paragraph 2"],
      choicesEn: ["english choice 1", "english choice 2", "english choice 3"],
      imagePrompt:
        "English illustration prompt for children's storybook image generation",
    },
    rules: [
      "paragraphs and choices must be Korean",
      "if includeEnglish is false, paragraphsEn and choicesEn can be empty arrays",
      "paragraphsEn and choicesEn must align by index with Korean text when includeEnglish=true",
      "no html, markdown, or extra keys",
    ],
  };

  const response = await client.chat.completions.create({
    model: STORY_MODEL,
    temperature: 0.75,
    response_format: {
      type: "json_schema",
      json_schema: STORY_RESPONSE_SCHEMA,
    },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: JSON.stringify(userPrompt) },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("LLM returned empty response");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error("Failed to parse LLM JSON response");
  }

  return sanitizeStoryTurn(parsed);
}

export async function translateKoreanParagraphs(
  paragraphs: string[],
): Promise<string[]> {
  const cleaned = paragraphs.map(item => item.trim()).filter(Boolean);
  if (cleaned.length === 0) return [];

  const client = getClient();

  const response = await client.chat.completions.create({
    model: STORY_MODEL,
    temperature: 0.3,
    response_format: {
      type: "json_schema",
      json_schema: TRANSLATION_RESPONSE_SCHEMA,
    },
    messages: [
      {
        role: "system",
        content:
          "Translate Korean children's story paragraphs into simple child-friendly English. Return valid JSON only.",
      },
      {
        role: "user",
        content: JSON.stringify({
          paragraphs: cleaned,
          outputSchema: { paragraphsEn: ["..."] },
        }),
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return [];

  try {
    const parsed = JSON.parse(content) as { paragraphsEn?: unknown };
    return normalizeStringList(parsed.paragraphsEn);
  } catch (error) {
    return [];
  }
}

export async function generateStoryImageBase64(
  imagePrompt: string,
): Promise<string | null> {
  const client = getClient();

  const prompt =
    imagePrompt.trim().length > 0
      ? imagePrompt
      : "A cheerful Korean children's storybook illustration, warm and colorful.";

  const response = await client.images.generate({
    model: IMAGE_MODEL,
    prompt,
    size: "1024x1024",
    response_format: "b64_json",
    n: 1,
  });

  return response.data?.[0]?.b64_json ?? null;
}
