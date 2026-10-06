import { NextRequest, NextResponse } from "next/server";

import { REQUEST_ID_HEADER, resolveRequestId } from "@/lib/server/request-id";

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  if (
    request.method === "GET" &&
    pathname === "/" &&
    ["code", "error", "error_code", "error_description"].some(key =>
      searchParams.get(key)?.trim(),
    )
  ) {
    // Handle providers that fall back to the site's home URL before the SDK
    // consumes the code, so callback errors and the saved return path survive.
    const callbackUrl = request.nextUrl.clone();
    callbackUrl.pathname = "/auth/callback";
    return NextResponse.redirect(callbackUrl);
  }

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
  matcher: ["/", "/api/v1/:path*"],
};
