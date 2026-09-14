import { NextRequest, NextResponse } from "next/server";

import { requireServerUser } from "@/app/api/server-auth";
import { paymentAdmin, paymentConfigured } from "@/app/api/server-payment";
import { beadPackages } from "@/app/utils/bead-packages";

export async function POST(req: NextRequest) {
  let user;
  try {
    ({ user } = await requireServerUser(
      req.headers.get("authorization")?.replace(/^Bearer /, ""),
    ));
  } catch {
    return NextResponse.json(
      { error: "로그인 후 다시 시도해주세요." },
      { status: 401 },
    );
  }
  if (!paymentConfigured())
    return NextResponse.json(
      {
        error:
          "곶감 충전을 준비하고 있어요. 기존 곶감은 계속 사용할 수 있어요.",
      },
      { status: 503 },
    );
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "주문 정보를 확인해주세요." },
      { status: 400 },
    );
  }
  const pkg = beadPackages.find(
    item => item.quantity === (body as { quantity?: unknown } | null)?.quantity,
  );
  if (!pkg)
    return NextResponse.json(
      { error: "곶감 수량을 확인해주세요." },
      { status: 400 },
    );
  const orderId = `HODAM_${crypto.randomUUID()}`;
  const { error } = await paymentAdmin().from("payment_history").insert({
    order_id: orderId,
    user_id: user.id,
    amount: pkg.price,
    bead_quantity: pkg.quantity,
    status: "pending",
  });
  if (error)
    return NextResponse.json(
      { error: "주문을 만들지 못했어요. 다시 시도해주세요." },
      { status: 500 },
    );
  return NextResponse.json({ orderId, amount: pkg.price });
}
