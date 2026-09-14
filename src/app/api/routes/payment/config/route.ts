import { NextResponse } from "next/server";

import { paymentConfigured } from "@/app/api/server-payment";

export function GET() {
  return NextResponse.json(
    { enabled: paymentConfigured() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
