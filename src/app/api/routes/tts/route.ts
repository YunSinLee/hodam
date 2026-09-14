import { NextRequest, NextResponse } from "next/server";

import { requireServerUser } from "@/app/api/server-auth";

import googleTtsApi from "../../google-tts";

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireServerUser(
      req.headers.get("authorization")?.replace(/^Bearer /, ""),
    );
  } catch {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { text, language = "ko", pitch = 1.0 } = body;

    if (
      typeof text !== "string" ||
      !text.trim() ||
      text.length > 5000 ||
      !["ko", "en"].includes(language) ||
      typeof pitch !== "number" ||
      !Number.isFinite(pitch) ||
      pitch < 0.5 ||
      pitch > 2
    ) {
      return NextResponse.json(
        { error: "텍스트가 제공되지 않았습니다." },
        { status: 400 },
      );
    }

    const { data: quota, error: quotaError } = await session.client.rpc(
      "consume_daily_quota",
      {
        p_user_id: session.user.id,
        p_action: "tts",
        p_cost: 1,
        p_daily_limit: 100,
      },
    );
    if (quotaError || !quota?.[0]?.allowed)
      return NextResponse.json(
        {
          error:
            "지금은 읽어주기를 사용할 수 없어요. 잠시 후 다시 시도해주세요.",
        },
        { status: 429 },
      );
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
