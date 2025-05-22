/**
 * Google Translate TTS API를 이용한 무료 음성 변환 기능
 * 참고: 이 API는 비공식이므로 Google 정책 변경 시 작동하지 않을 수 있습니다.
 */

// 캐시 인터페이스 정의
interface TtsCache {
  [key: string]: {
    data: string;
    timestamp: number;
  };
}

// 간단한 인메모리 캐시 (서버 재시작 시 초기화됨)
const ttsCache: TtsCache = {};

// 캐시 유효 시간 (24시간)
const CACHE_TTL = 24 * 60 * 60 * 1000;

const googleTtsApi = {
  /**
   * 텍스트를 음성 URL로 변환하는 함수
   * @param text 변환할 텍스트 (최대 200자 권장)
   * @param language 언어 코드 (ko, en-US 등)
   * @param pitch 음성 피치 (0.5~2.0, 기본값 1.0)
   * @returns 음성 URL
   */
  getAudioUrl(
    text: string,
    language: string = "ko",
    pitch: number = 1.0,
  ): string {
    // 텍스트가 너무 길면 잘라내기 (Google TTS 최대 제한)
    if (text.length > 200) {
      text = `${text.substring(0, 197)}...`;
    }

    // 텍스트 URL 인코딩
    const encodedText = encodeURIComponent(text);

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
  getAudioUrlsForLongText(
    text: string,
    language: string = "ko",
    pitch: number = 1.0,
  ): string[] {
    // 문장 단위로 텍스트 분할
    const sentences = text.split(/(?<=[.!?])\s+/);

    const urls: string[] = [];
    let currentChunk = "";

    // 청크 단위로 묶기 (최대 200자)
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > 190) {
        urls.push(this.getAudioUrl(currentChunk, language, pitch));
        currentChunk = sentence;
      } else {
        currentChunk += (currentChunk ? " " : "") + sentence;
      }
    }

    // 마지막 청크 추가
    if (currentChunk) {
      urls.push(this.getAudioUrl(currentChunk, language, pitch));
    }

    return urls;
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
      console.log(
        `[TTS] 캐시에서 오디오 데이터 로드: ${cacheKey.substring(0, 30)}...`,
      );
      return cachedItem.data;
    }

    // 캐시에 없으면 새로 가져옴
    console.log(`[TTS] 새 오디오 데이터 생성: ${cacheKey.substring(0, 30)}...`);
    const url = this.getAudioUrl(text, language, pitch);

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
    } catch (error) {
      console.error("TTS API 호출 오류:", error);
      throw error;
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
    // 문장 단위로 텍스트 분할
    const sentences = text.split(/(?<=[.!?])\s+/);

    const audioDataArray: string[] = [];
    let currentChunk = "";
    const chunks: string[] = [];

    // 청크 단위로 묶기 (최대 200자)
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > 190) {
        chunks.push(currentChunk);
        currentChunk = sentence;
      } else {
        currentChunk += (currentChunk ? " " : "") + sentence;
      }
    }

    // 마지막 청크 추가
    if (currentChunk) {
      chunks.push(currentChunk);
    }

    // 각 청크를 병렬로 처리하여 캐시된 오디오 데이터 가져오기
    const results = await Promise.all(
      chunks.map(chunk => this.getAudioWithCache(chunk, language, pitch)),
    );

    return results;
  },
};

export default googleTtsApi;
