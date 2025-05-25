import { NextRequest, NextResponse } from "next/server";

import googleTtsApi from "../../google-tts";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, language = "ko", pitch = 1.0 } = body;

    if (!text) {
      return NextResponse.json(
        { error: "텍스트가 제공되지 않았습니다." },
        { status: 400 },
      );
    }

    // 캐싱을 활용한 오디오 데이터 가져오기
    const audioDataArray =
      text.length > 190
        ? await googleTtsApi.getAudioArrayWithCache(text, language, pitch)
        : [await googleTtsApi.getAudioWithCache(text, language, pitch)];

    return NextResponse.json({
      audioDataArray,
      contentType: "audio/mp3",
    });
  } catch (error) {
    console.error("TTS API 오류:", error);
    return NextResponse.json(
      { error: "음성 생성 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
