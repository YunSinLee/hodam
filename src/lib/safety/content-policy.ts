const BLOCKED_TOPICS = [
  // Korean
  "자살",
  "자해",
  "살인",
  "성폭행",
  "강간",
  "포르노",
  "음란",
  "마약",
  "테러",
  "폭탄",
  "총기",
  "도박",
  // English
  "suicide",
  "self-harm",
  "murder",
  "rape",
  "porn",
  "drugs",
  "terror",
  "bomb",
  "gambling",
] as const;

interface StoryOutputLike {
  notice?: string | null;
  imagePrompt?: string | null;
  paragraphs?: string[] | null;
  choices?: string[] | null;
}

function normalizeText(input: string): string {
  return input.toLowerCase().replace(/\s+/g, " ").trim();
}

export function detectBlockedTopic(texts: string[]): string | null {
  const normalizedTexts = texts
    .map(text => normalizeText(text))
    .filter(Boolean);

  return (
    normalizedTexts
      .map(text => BLOCKED_TOPICS.find(topic => text.includes(topic)) || null)
      .find(Boolean) || null
  );
}

export function detectBlockedTopicInStoryOutput(
  output: StoryOutputLike,
): string | null {
  const texts = [
    ...(Array.isArray(output.paragraphs) ? output.paragraphs : []),
    ...(Array.isArray(output.choices) ? output.choices : []),
    typeof output.notice === "string" ? output.notice : "",
    typeof output.imagePrompt === "string" ? output.imagePrompt : "",
  ];

  return detectBlockedTopic(texts);
}
