import { NextRequest, NextResponse } from "next/server";

// 토스페이먼츠 결제 승인 API
export async function POST(req: NextRequest) {
  try {
    const { paymentKey, orderId, amount } = await req.json();

    // 필수 파라미터 검증
    if (!paymentKey || !orderId || !amount) {
      return NextResponse.json(
        { error: "필수 파라미터가 누락되었습니다." },
        { status: 400 },
      );
    }

    // 토스페이먼츠 시크릿 키 확인
    const secretKey = process.env.TOSS_PAYMENTS_SECRET_KEY;
    if (!secretKey) {
      console.error("토스페이먼츠 시크릿 키가 설정되지 않았습니다.");
      return NextResponse.json(
        { error: "결제 시스템 설정 오류입니다." },
        { status: 500 },
      );
    }

    // 재시도 로직을 포함한 토스페이먼츠 결제 승인 요청
    let tossResult;
    let lastError;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`토스페이먼츠 결제 승인 시도 ${attempt}/3`);

        const tossResponse = await fetch(
          "https://api.tosspayments.com/v1/payments/confirm",
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              paymentKey,
              orderId,
              amount,
            }),
          },
        );

        tossResult = await tossResponse.json();

        if (tossResponse.ok) {
          // 성공
          console.log("토스페이먼츠 결제 승인 성공:", {
            paymentKey: tossResult.paymentKey,
            orderId: tossResult.orderId,
            amount: tossResult.totalAmount,
            status: tossResult.status,
            attempt,
          });
          break;
        } else {
          // 실패
          lastError = tossResult;
          console.error(
            `토스페이먼츠 결제 승인 실패 (시도 ${attempt}/3):`,
            tossResult,
          );

          // PROVIDER_ERROR인 경우 재시도
          if (tossResult.code === "PROVIDER_ERROR" && attempt < 3) {
            console.log(
              `PROVIDER_ERROR 발생, ${attempt + 1}번째 시도 준비 중...`,
            );
            await new Promise<void>(resolve => {
              setTimeout(() => resolve(), 1000 * attempt);
            }); // 지수 백오프
            continue;
          } else {
            // 재시도 불가능한 오류이거나 최대 시도 횟수 도달
            return NextResponse.json(
              {
                error: tossResult.message || "결제 승인에 실패했습니다.",
                code: tossResult.code,
              },
              { status: 400 },
            );
          }
        }
      } catch (networkError) {
        lastError = networkError;
        console.error(`네트워크 오류 (시도 ${attempt}/3):`, networkError);

        if (attempt < 3) {
          await new Promise<void>(resolve => {
            setTimeout(() => resolve(), 1000 * attempt);
          });
          continue;
        }
      }
    }

    if (!tossResult || !tossResult.paymentKey) {
      console.error("모든 재시도 실패:", lastError);
      return NextResponse.json(
        { error: "결제 승인에 실패했습니다. 잠시 후 다시 시도해주세요." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      payment: {
        paymentKey: tossResult.paymentKey,
        orderId: tossResult.orderId,
        amount: tossResult.totalAmount,
        status: tossResult.status,
        approvedAt: tossResult.approvedAt,
        method: tossResult.method,
      },
    });
  } catch (error) {
    console.error("결제 승인 처리 중 오류:", error);
    return NextResponse.json(
      { error: "결제 승인 처리 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
