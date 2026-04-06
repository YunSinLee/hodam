/**
 * Google Translate TTS API를 이용한 무료 음성 변환 기능
 * 참고: 이 API는 비공식이므로 Google 정책 변경 시 작동하지 않을 수 있습니다.
 */

interface TtsCacheEntry {
  data: string;
  timestamp: number;
}

type TtsCache = Record<string, TtsCacheEntry>;

// 간단한 인메모리 캐시 (서버 재시작 시 초기화됨)
const ttsCache: TtsCache = {};

// 캐시 유효 시간 (24시간)
const CACHE_TTL = 24 * 60 * 60 * 1000;

const MAX_TTS_LENGTH = 200;
const SAFE_CHUNK_LENGTH = 190;

function trimTextForGoogleTts(text: string): string {
  if (text.length <= MAX_TTS_LENGTH) return text;
  return `${text.substring(0, MAX_TTS_LENGTH - 3)}...`;
}

function splitTextIntoChunks(text: string): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length === 0) return [text];

  const chunks = sentences.reduce<string[]>((accumulator, sentence) => {
    if (accumulator.length === 0) {
      return [sentence];
    }

    const lastIndex = accumulator.length - 1;
    const current = accumulator[lastIndex];
    const candidate = `${current}${current ? " " : ""}${sentence}`;

    if (candidate.length > SAFE_CHUNK_LENGTH) {
      return [...accumulator, sentence];
    }

    return [...accumulator.slice(0, lastIndex), candidate];
  }, []);

  return chunks.length > 0 ? chunks : [text];
}

const googleTtsApi = {
  /**
   * 텍스트를 음성 URL로 변환하는 함수
   * @param text 변환할 텍스트 (최대 200자 권장)
   * @param language 언어 코드 (ko, en-US 등)
   * @param pitch 음성 피치 (0.5~2.0, 기본값 1.0)
   * @returns 음성 URL
   */
  getAudioUrl(text: string, language: string = "ko"): string {
    const encodedText = encodeURIComponent(trimTextForGoogleTts(text));

    // Google Translate TTS URL 생성
    // 참고: 구글 TTS API는 공식적으로 피치 조절을 지원하지 않음
    return `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${language}&q=${encodedText}`;
  },

  /**
   * 긴 텍스트를 여러 청크로 나누어 URL 배열로 반환
   * @param text 변환할 텍스트
   * @param language 언어 코드
   * @param pitch 음성 피치 (0.5~2.0, 기본값 1.0)
   * @returns 음성 URL 배열
   */
  getAudioUrlsForLongText(text: string, language: string = "ko"): string[] {
    return splitTextIntoChunks(text).map(chunk =>
      this.getAudioUrl(chunk, language),
    );
  },

  /**
   * 캐시에서 오디오 데이터를 가져오거나 새로 생성하여 반환
   * @param text 변환할 텍스트
   * @param language 언어 코드
   * @param pitch 음성 피치 (0.5~2.0, 기본값 1.0)
   * @returns 오디오 데이터 (base64 인코딩)
   */
  async getAudioWithCache(
    text: string,
    language: string = "ko",
    pitch: number = 1.0,
  ): Promise<string> {
    // 캐시 키 생성 (텍스트+언어+피치)
    const cacheKey = `${language}:${pitch}:${text}`;

    // 캐시에 있고 유효한지 확인
    const cachedItem = ttsCache[cacheKey];
    const now = Date.now();

    if (cachedItem && now - cachedItem.timestamp < CACHE_TTL) {
      return cachedItem.data;
    }

    const url = this.getAudioUrl(text, language);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`오디오 데이터 가져오기 실패: ${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      const base64Data = Buffer.from(buffer).toString("base64");

      // 캐시에 저장
      ttsCache[cacheKey] = {
        data: base64Data,
        timestamp: now,
      };

      return base64Data;
    } catch (error: unknown) {
      throw error instanceof Error
        ? error
        : new Error("TTS API 호출 중 오류가 발생했습니다.");
    }
  },

  /**
   * 긴 텍스트를 여러 청크로 나누어 각각 캐시를 적용하여 오디오 데이터 배열로 반환
   * @param text 변환할 텍스트
   * @param language 언어 코드
   * @param pitch 음성 피치 (0.5~2.0, 기본값 1.0)
   * @returns 오디오 데이터 배열 (base64 인코딩)
   */
  async getAudioArrayWithCache(
    text: string,
    language: string = "ko",
    pitch: number = 1.0,
  ): Promise<string[]> {
    const chunks = splitTextIntoChunks(text);
    const results = await Promise.all(
      chunks.map(chunk => this.getAudioWithCache(chunk, language, pitch)),
    );

    return results;
  },
};

export default googleTtsApi;
