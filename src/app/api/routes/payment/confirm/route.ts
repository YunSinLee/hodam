import { NextRequest, NextResponse } from "next/server";

import { requireServerUser } from "@/app/api/server-auth";
import { paymentAdmin, paymentConfigured } from "@/app/api/server-payment";
import { validPackage, validPaymentInput } from "@/app/utils/bead-packages";

export async function POST(req: NextRequest) {
  let user;
  try {
    ({ user } = await requireServerUser(
      req.headers.get("authorization")?.replace(/^Bearer /, ""),
    ));
  } catch {
    return NextResponse.json(
      { error: "로그인 후 결제 상태를 다시 확인해주세요." },
      { status: 401 },
    );
  }
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "결제 정보를 확인해주세요." },
      { status: 400 },
    );
  }
  if (!validPaymentInput(body))
    return NextResponse.json(
      { error: "결제 정보를 확인해주세요." },
      { status: 400 },
    );
  if (!paymentConfigured())
    return NextResponse.json(
      {
        error:
          "결제 확인을 일시적으로 사용할 수 없어요. 문의하기로 알려주세요.",
      },
      { status: 503 },
    );
  const { paymentKey, orderId, amount } = body;
  const admin = paymentAdmin();
  const { data: order, error } = await admin
    .from("payment_history")
    .select("*")
    .eq("order_id", orderId)
    .eq("user_id", user.id)
    .single();
  if (error || !order)
    return NextResponse.json(
      { error: "내 계정의 주문을 찾을 수 없어요." },
      { status: 404 },
    );
  if (
    order.amount !== amount ||
    !validPackage(order.bead_quantity, amount) ||
    order.status === "cancelled" ||
    (order.payment_key && order.payment_key !== paymentKey)
  )
    return NextResponse.json(
      { error: "주문 정보와 결제 정보가 일치하지 않아요." },
      { status: 400 },
    );
  if (order.status === "completed") {
    if (!order.credited_at || order.credited_user_id !== user.id)
      return NextResponse.json(
        {
          error:
            "기존 결제의 지급 내역을 확인해야 해요. 문의하기로 알려주세요.",
        },
        { status: 409 },
      );
    return NextResponse.json({ success: true, alreadyProcessed: true });
  }
  try {
    const authorization = `Basic ${Buffer.from(`${process.env.TOSS_PAYMENTS_SECRET_KEY}:`).toString("base64")}`;
    let response = await fetch(
      "https://api.tosspayments.com/v1/payments/confirm",
      {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
          "Idempotency-Key": `confirm_${orderId}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
      },
    );
    let payment = await response.json();
    // A previous approval may have succeeded before the response or DB save failed.
    if (!response.ok && payment.code === "ALREADY_PROCESSED_PAYMENT") {
      response = await fetch(
        `https://api.tosspayments.com/v1/payments/${encodeURIComponent(paymentKey)}`,
        {
          headers: { Authorization: authorization },
          signal: AbortSignal.timeout(15000),
        },
      );
      payment = await response.json();
    }
    if (
      !response.ok ||
      payment.status !== "DONE" ||
      payment.orderId !== orderId ||
      payment.paymentKey !== paymentKey ||
      payment.totalAmount !== amount
    )
      return NextResponse.json(
        {
          error: "결제 승인을 확인하지 못했어요. 다시 확인하거나 문의해주세요.",
        },
        { status: 409 },
      );
    // Existing DB function locks the order and credits exactly once in one transaction.
    const { error: finalizeError } = await admin.rpc("finalize_payment", {
      p_order_id: orderId,
      p_payment_key: paymentKey,
      p_user_id: user.id,
    });
    if (finalizeError)
      return NextResponse.json(
        {
          error:
            "결제는 승인됐지만 곶감 지급 확인이 지연되고 있어요. 다시 확인해주세요.",
        },
        { status: 503 },
      );
    return NextResponse.json({ success: true });
  } catch {
    // A timeout is not proof of a failed payment. Keep the order retryable.
    return NextResponse.json(
      {
        error:
          "결제 상태를 확인하지 못했어요. 중복 구매하지 말고 다시 확인해주세요.",
      },
      { status: 503 },
    );
  }
}
