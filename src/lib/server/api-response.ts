import { NextResponse } from "next/server";

import { withRequestIdHeaders } from "@/lib/server/request-id";

interface ApiResponseInit extends Omit<ResponseInit, "headers"> {
  headers?: HeadersInit;
  requestId?: string;
}

function toResponseInit(init?: ApiResponseInit): ResponseInit | undefined {
  if (!init) return undefined;
  const { requestId, headers, ...rest } = init;
  return {
    ...rest,
    headers: withRequestIdHeaders(headers, requestId),
  };
}

export function ok<T>(data: T, init?: ApiResponseInit) {
  return NextResponse.json(data, toResponseInit(init));
}

export function fail(
  status: number,
  error: string,
  extra?: Record<string, unknown>,
  init?: ApiResponseInit,
) {
  const resolved = toResponseInit(init);
  return NextResponse.json(
    {
      error,
      ...(extra || {}),
    },
    {
      ...(resolved || {}),
      status,
    },
  );
}
