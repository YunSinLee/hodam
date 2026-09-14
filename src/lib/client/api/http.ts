import { supabase } from "@/app/utils/supabase";

import type { ZodType, ZodTypeDef } from "zod";

const SESSION_RETRY_ATTEMPTS = 20;
const SESSION_RETRY_DELAY_MS = process.env.NODE_ENV === "test" ? 1 : 250;
const TRANSIENT_RETRY_DELAY_MS = process.env.NODE_ENV === "test" ? 1 : 250;
const TRANSIENT_RETRYABLE_STATUSES = new Set([500, 502, 503, 504]);
const TRANSIENT_RETRYABLE_METHODS = new Set(["GET", "HEAD"]);

export class ApiError extends Error {
  status: number;

  code?: string;

  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code =
      details &&
      typeof details === "object" &&
      "code" in details &&
      typeof (details as { code?: unknown }).code === "string"
        ? ((details as { code: string }).code as string)
        : undefined;
    this.details = details;
  }
}

export function getApiErrorCode(error: unknown): string | null {
  if (error instanceof ApiError) {
    return error.code || null;
  }

  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }

  return null;
}

export interface AuthorizedFetchResult<T> {
  data: T;
  status: number;
  headers: Headers;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

function isJwtLikeToken(value: string): boolean {
  const token = value.trim();
  if (!token) return false;
  const segments = token.split(".");
  return segments.length === 3 && segments.every(segment => segment.length > 0);
}

function readTokenFromUnknown(value: unknown): string | null {
  if (!value) return null;

  if (typeof value === "string") {
    return isJwtLikeToken(value) ? value : null;
  }

  if (typeof value !== "object") return null;

  const record = value as Record<string, unknown>;

  const direct =
    (typeof record.access_token === "string" && record.access_token) ||
    (typeof record.token === "string" && record.token) ||
    null;
  if (direct && isJwtLikeToken(direct)) {
    return direct;
  }

  const nestedCandidates = [record.currentSession, record.session, record[0]];
  return (
    nestedCandidates
      .map(candidate => readTokenFromUnknown(candidate))
      .find(Boolean) || null
  );
}

function readAccessTokenFromLocalStorage(): string | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  try {
    const storage = window.localStorage;
    const keys: string[] = [];

    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (typeof key === "string") {
        keys.push(key);
      }
    }

    const authTokenKeys = keys.filter(
      key => key.startsWith("sb-") && key.endsWith("-auth-token"),
    );

    const resolvedTokens = authTokenKeys
      .map(key => storage.getItem(key))
      .filter((raw): raw is string => Boolean(raw))
      .map(raw => {
        let parsed: unknown = raw;
        try {
          parsed = JSON.parse(raw);
        } catch {
          // Keep raw string for legacy token-only storage format.
        }
        return readTokenFromUnknown(parsed);
      })
      .filter((token): token is string => Boolean(token));

    return resolvedTokens[0] || null;
  } catch {
    return null;
  }
}

async function readAccessTokenOnce(): Promise<string | null> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw new ApiError(401, "Failed to read auth session", error);
  }

  const sessionToken = session?.access_token || null;
  if (sessionToken) {
    return sessionToken;
  }

  return readAccessTokenFromLocalStorage();
}

async function readAccessTokenWithRetry(attempt = 0): Promise<string | null> {
  const accessToken = await readAccessTokenOnce();
  if (accessToken) {
    return accessToken;
  }

  if (attempt >= SESSION_RETRY_ATTEMPTS - 1) {
    return null;
  }

  await sleep(SESSION_RETRY_DELAY_MS);
  return readAccessTokenWithRetry(attempt + 1);
}

async function getAccessTokenOrThrow() {
  const accessToken = await readAccessTokenWithRetry();
  if (!accessToken) {
    throw new ApiError(401, "로그인이 필요합니다.");
  }

  return accessToken;
}

async function refreshAccessToken(): Promise<string | null> {
  try {
    if (typeof supabase.auth.refreshSession !== "function") {
      return null;
    }

    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      return null;
    }

    const refreshedToken = data?.session?.access_token || null;
    if (refreshedToken) {
      return refreshedToken;
    }

    return await readAccessTokenWithRetry();
  } catch {
    return null;
  }
}

function mergeHeaders(
  baseHeaders: Record<string, string>,
  headers?: HeadersInit,
): Headers {
  const merged = new Headers(baseHeaders);

  if (!headers) return merged;

  const incoming = new Headers(headers);
  incoming.forEach((value, key) => {
    merged.set(key, value);
  });

  return merged;
}

export async function authorizedFetch<T>(
  input: string,
  init: RequestInit = {},
  schema?: ZodType<T, ZodTypeDef, unknown>,
): Promise<T> {
  const result = await authorizedFetchWithMeta(input, init, schema);
  return result.data;
}

export async function authorizedFetchWithMeta<T>(
  input: string,
  init: RequestInit = {},
  schema?: ZodType<T, ZodTypeDef, unknown>,
): Promise<AuthorizedFetchResult<T>> {
  const parseResponsePayload = async (response: Response) => {
    const contentType = response.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");

    if (!isJson) {
      return {
        isJson: false,
        payload: await response.text(),
      };
    }

    const rawPayload = await response.text();
    if (!rawPayload.trim()) {
      return {
        isJson: true,
        payload: null,
      };
    }

    try {
      return {
        isJson: true,
        payload: JSON.parse(rawPayload),
      };
    } catch (error) {
      if (!response.ok) {
        return {
          isJson: false,
          payload: rawPayload,
        };
      }

      throw new ApiError(502, "Invalid JSON response", {
        contentType,
        bodyPreview: rawPayload.slice(0, 300),
      });
    }
  };

  const requestWithToken = async (accessToken: string) => {
    const headers = mergeHeaders(
      {
        Authorization: `Bearer ${accessToken}`,
      },
      init.headers,
    );

    if (!(init.body instanceof FormData) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(input, {
      ...init,
      headers,
    });

    const parsed = await parseResponsePayload(response);

    return { response, ...parsed };
  };

  const requestMethod = String(init.method || "GET").toUpperCase();
  const canRetryTransient = TRANSIENT_RETRYABLE_METHODS.has(requestMethod);
  let activeAccessToken = await getAccessTokenOrThrow();
  let result = await requestWithToken(activeAccessToken);

  if (result.response.status === 401) {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken && refreshedToken !== activeAccessToken) {
      activeAccessToken = refreshedToken;
      result = await requestWithToken(activeAccessToken);
    }
  }

  if (canRetryTransient && result.response.status === 401) {
    const latestAccessToken = await readAccessTokenWithRetry();
    if (latestAccessToken) {
      activeAccessToken = latestAccessToken;
      await sleep(SESSION_RETRY_DELAY_MS);
      result = await requestWithToken(activeAccessToken);
    }
  }

  if (
    canRetryTransient &&
    TRANSIENT_RETRYABLE_STATUSES.has(result.response.status)
  ) {
    await sleep(TRANSIENT_RETRY_DELAY_MS);
    result = await requestWithToken(activeAccessToken);
  }

  if (!result.response.ok) {
    const message =
      result.isJson &&
      result.payload &&
      typeof result.payload.error === "string"
        ? result.payload.error
        : `Request failed (${result.response.status})`;

    throw new ApiError(result.response.status, message, result.payload);
  }

  let data: T;
  if (schema) {
    const parsed = schema.safeParse(result.payload);
    if (!parsed.success) {
      throw new ApiError(
        502,
        "Invalid API response schema",
        parsed.error.flatten(),
      );
    }

    data = parsed.data;
  } else {
    data = result.payload as T;
  }

  return {
    data,
    status: result.response.status,
    headers: new Headers(result.response.headers),
  };
}
