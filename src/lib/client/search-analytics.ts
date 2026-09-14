const SOURCE_STORAGE_KEY = "hodam:search-source";

export const SEARCH_SOURCES = [
  "bedtime",
  "ai-maker",
  "moonlit-rabbit",
  "pinecone-promise",
  "little-fox-crossing",
] as const;

export type SearchSource = (typeof SEARCH_SOURCES)[number];

export function searchSourceForPathname(pathname: string): SearchSource | null {
  if (pathname === "/bedtime-stories") return "bedtime";
  if (pathname === "/ai-storybook") return "ai-maker";
  return (
    SEARCH_SOURCES.find(
      source =>
        source !== "bedtime" &&
        source !== "ai-maker" &&
        pathname === `/bedtime-stories/${source}`,
    ) ?? null
  );
}

type SearchEvent =
  | "hodam_cta_click"
  | "hodam_generation_started"
  | "hodam_generation_completed";

export interface SearchGenerationAttempt {
  readonly source: SearchSource;
  completed: boolean;
}

let memorySource: SearchSource | null = null;
// Correlation stays in memory. Neither private book IDs nor input text is
// written to analytics or browser storage. Reloads may undercount completion.
const pendingBooks = new Map<number, SearchGenerationAttempt>();

function isSearchSource(value: unknown): value is SearchSource {
  return SEARCH_SOURCES.some(source => source === value);
}

function sendEvent(name: SearchEvent, source: SearchSource): void {
  if (typeof window === "undefined" || !isSearchSource(source)) return;
  try {
    const { gtag } = window as Window & {
      gtag?: (...args: unknown[]) => void;
    };
    if (typeof gtag !== "function") return;
    gtag("event", name, {
      search_source: source,
      // Override GA's default URL/referrer fields so these custom events do
      // not include private book routes, OAuth queries, or arbitrary queries.
      page_location: `${window.location.origin}/service`,
      page_referrer: "",
      page_title: "그림책 만들기 | 호담",
    });
  } catch {
    // Analytics and browser extensions must never interrupt making a book.
  }
}

export function trackSearchCta(source: SearchSource): void {
  if (typeof window === "undefined" || !isSearchSource(source)) return;
  memorySource = source;
  try {
    window.sessionStorage.setItem(SOURCE_STORAGE_KEY, source);
  } catch {
    // Same-page client navigation can still use the memory fallback.
  }
  sendEvent("hodam_cta_click", source);
}

function readSource(): SearchSource | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.sessionStorage.getItem(SOURCE_STORAGE_KEY);
    if (isSearchSource(stored)) return stored;
  } catch {
    // Storage may be blocked in private browsing.
  }
  return memorySource;
}

export function beginSearchGeneration(
  previous: SearchGenerationAttempt | null = null,
): SearchGenerationAttempt | null {
  // A retry of the same idempotent generation request is one start.
  if (previous) return previous;
  const source = readSource();
  if (!source) return null;
  const attempt = { source, completed: false };
  sendEvent("hodam_generation_started", source);
  return attempt;
}

export function associateSearchGeneration(
  attempt: SearchGenerationAttempt | null,
  threadId: number,
): void {
  if (!attempt || attempt.completed || !Number.isSafeInteger(threadId)) return;
  if (threadId <= 0) return;
  // Keep this bounded even when a tab is left open for a long time.
  if (pendingBooks.size >= 20) {
    const oldest = pendingBooks.keys().next().value;
    if (oldest !== undefined) pendingBooks.delete(oldest);
  }
  pendingBooks.set(threadId, attempt);
}

export function completeSearchGeneration(
  threadId: number,
  state: { status: string; pageCount: number; hasAllImages: boolean },
): void {
  if (
    state.status !== "complete" ||
    state.pageCount !== 8 ||
    !state.hasAllImages
  )
    return;
  const attempt = pendingBooks.get(threadId);
  if (!attempt || attempt.completed) return;
  attempt.completed = true;
  pendingBooks.delete(threadId);
  sendEvent("hodam_generation_completed", attempt.source);
}
