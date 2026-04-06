export const REQUEST_ID_HEADER = "x-request-id";
const MAX_REQUEST_ID_LENGTH = 128;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;

function normalizeRequestId(candidate: string | null | undefined) {
  if (!candidate) return null;
  const trimmed = candidate.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_REQUEST_ID_LENGTH) return null;
  if (!REQUEST_ID_PATTERN.test(trimmed)) return null;
  return trimmed;
}

function generateRequestId() {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  const randomSuffix = Math.random().toString(36).slice(2, 12);
  const timestamp = Date.now().toString(36);
  return `req_${timestamp}_${randomSuffix}`;
}

export function resolveRequestId(headers: Pick<Headers, "get">) {
  return (
    normalizeRequestId(headers.get(REQUEST_ID_HEADER)) || generateRequestId()
  );
}

export function withRequestIdHeaders(
  headers: HeadersInit | undefined,
  requestId: string | null | undefined,
) {
  const nextHeaders = new Headers(headers);
  const normalized = normalizeRequestId(requestId || null);
  if (normalized) {
    nextHeaders.set(REQUEST_ID_HEADER, normalized);
  }
  return nextHeaders;
}

export const requestIdInternal = {
  MAX_REQUEST_ID_LENGTH,
  REQUEST_ID_PATTERN,
};
