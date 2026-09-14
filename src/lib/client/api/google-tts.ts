/** Google Translate TTS requests, split to preserve the full story text. */
interface CachedAudio {
  data: string;
  timestamp: number;
}

const ttsCache = new Map<string, CachedAudio>();
const MAX_CACHE_ENTRIES = 256;
const MAX_CHUNK_LENGTH = 190;
const CACHE_TTL = 24 * 60 * 60 * 1000;

function splitAudioText(text: string): string[] {
  const chunks: string[] = [];
  let currentChunk = "";

  // Iterate code points, but count UTF-16 units conservatively for the provider
  // limit. A surrogate pair always moves into the same request.
  Array.from(text).forEach(character => {
    if (currentChunk.length + character.length > MAX_CHUNK_LENGTH) {
      chunks.push(currentChunk);
      currentChunk = "";
    }
    currentChunk += character;
  });
  if (currentChunk) chunks.push(currentChunk);

  return chunks;
}

const googleTtsApi = {
  getAudioUrl(text: string, language: string = "ko"): string {
    if (text.length > MAX_CHUNK_LENGTH) {
      throw new Error("긴 문장은 음성 배열로 요청해주세요.");
    }
    return `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(language)}&q=${encodeURIComponent(text)}`;
  },

  getAudioUrlsForLongText(text: string, language: string = "ko"): string[] {
    return splitAudioText(text).map(chunk => this.getAudioUrl(chunk, language));
  },

  async getAudioWithCache(
    text: string,
    language: string = "ko",
    pitch: number = 1.0,
  ): Promise<string> {
    const cacheKey = `${language}:${pitch}:${text}`;
    const cachedItem = ttsCache.get(cacheKey);
    if (cachedItem && Date.now() - cachedItem.timestamp < CACHE_TTL) {
      return cachedItem.data;
    }

    const url = this.getAudioUrl(text, language);
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
      throw new Error(`오디오 데이터 가져오기 실패: ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    const base64Data = Buffer.from(buffer).toString("base64");

    // Replacing an expired entry must not evict an unrelated cached story.
    ttsCache.delete(cacheKey);
    if (ttsCache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = ttsCache.keys().next().value;
      if (oldestKey !== undefined) ttsCache.delete(oldestKey);
    }
    ttsCache.set(cacheKey, { data: base64Data, timestamp: Date.now() });
    return base64Data;
  },

  async getAudioArrayWithCache(
    text: string,
    language: string = "ko",
    pitch: number = 1.0,
  ): Promise<string[]> {
    return Promise.all(
      splitAudioText(text).map(chunk =>
        this.getAudioWithCache(chunk, language, pitch),
      ),
    );
  },
};

export default googleTtsApi;
