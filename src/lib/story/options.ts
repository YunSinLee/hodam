export interface StoryStartOptions {
  includeEnglish?: boolean;
  includeImage?: boolean;
}

export function calculateStoryStartCost(options: StoryStartOptions): number {
  const includeEnglish = Boolean(options.includeEnglish);
  const includeImage = Boolean(options.includeImage);
  return 1 + (includeEnglish ? 1 : 0) + (includeImage ? 1 : 0);
}

export function calculateStoryContinueCost(includeEnglish: boolean): number {
  return 1 + (includeEnglish ? 1 : 0);
}

export function normalizeStoryKeywords(rawKeywords: string): string[] {
  const deduplicated = new Set(
    rawKeywords
      .split(",")
      .map(item => item.trim())
      .filter(Boolean),
  );

  return Array.from(deduplicated);
}
