import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requestedText = (url: string) => new URL(url).searchParams.get("q")!;

beforeEach(() => vi.resetModules());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("lossless TTS chunks", () => {
  it.each([
    "가".repeat(1001),
    "한 문장이 아주 길어져도 모든 글자를 빠짐없이 읽어요 ".repeat(30),
    "안녕?  오늘은 어땠니!\n\n".repeat(40),
    `${"가".repeat(189)}🐯${"나".repeat(189)}🌙${"다".repeat(190)}`,
    "🐯🌙🧒".repeat(100),
  ])("keeps all input in nonempty provider-sized chunks", async text => {
    const { default: tts } = await import("../src/lib/client/api/google-tts");
    const chunks = tts.getAudioUrlsForLongText(text).map(requestedText);
    expect(chunks.join("")).toBe(text);
    expect(chunks.every(chunk => chunk.length > 0 && chunk.length <= 190)).toBe(
      true,
    );
    expect(
      chunks.every(chunk => !/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/.test(chunk)),
    ).toBe(true);

    const fetchMock = vi.fn(
      async (url: string, _init?: RequestInit) =>
        new Response(requestedText(url)),
    );
    vi.stubGlobal("fetch", fetchMock);
    const audio = await tts.getAudioArrayWithCache(text);
    expect(
      audio
        .map(encoded => Buffer.from(encoded, "base64").toString("utf8"))
        .join(""),
    ).toBe(text);
    expect(fetchMock.mock.calls.map(([url]) => requestedText(url))).toEqual(
      chunks,
    );
    expect(fetchMock.mock.calls[0][1]).toEqual({
      signal: expect.any(AbortSignal),
    });
  });

  it("does not emit an empty first request for a single long sentence", async () => {
    const { default: tts } = await import("../src/lib/client/api/google-tts");
    const chunks = tts
      .getAudioUrlsForLongText("호".repeat(191))
      .map(requestedText);
    expect(chunks).toEqual(["호".repeat(190), "호"]);
    expect(tts.getAudioUrlsForLongText("")).toEqual([]);
    await expect(tts.getAudioArrayWithCache("")).resolves.toEqual([]);
  });

  it("does not silently truncate a direct oversized URL request", async () => {
    const { default: tts } = await import("../src/lib/client/api/google-tts");
    expect(() => tts.getAudioUrl("가".repeat(191))).toThrow("음성 배열");
  });

  it("reuses cached requests and evicts entries beyond the 256 request limit", async () => {
    const { default: tts } = await import("../src/lib/client/api/google-tts");
    const fetchMock = vi.fn(async () => new Response("audio"));
    vi.stubGlobal("fetch", fetchMock);
    const timeout = vi.spyOn(AbortSignal, "timeout");
    await tts.getAudioWithCache("문장0");
    await tts.getAudioWithCache("문장0");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(timeout).toHaveBeenCalledWith(10000);
    await Promise.all(
      Array.from({ length: 256 }, (_, index) =>
        tts.getAudioWithCache(`문장${index + 1}`),
      ),
    );
    expect(fetchMock).toHaveBeenCalledTimes(257);
    await tts.getAudioWithCache("문장256");
    expect(fetchMock).toHaveBeenCalledTimes(257);
    await tts.getAudioWithCache("문장0");
    expect(fetchMock).toHaveBeenCalledTimes(258);
  });
});
