import { NextRequest, NextResponse } from "next/server";

import { REQUEST_ID_HEADER, resolveRequestId } from "@/lib/server/request-id";

export function middleware(request: NextRequest) {
  const requestId = resolveRequestId(request.headers);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

export const config = {
  matcher: ["/api/v1/:path*"],
};
