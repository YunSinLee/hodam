import { getOptionalEnv } from "@/lib/env";

const DEFAULT_TOSS_API_BASE_URL = "https://api.tosspayments.com";

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === "/") {
    return "";
  }

  return pathname.replace(/\/+$/, "");
}

function resolveBaseUrl(): URL {
  const configuredBaseUrl = getOptionalEnv("TOSS_PAYMENTS_API_BASE_URL");
  const rawBaseUrl = configuredBaseUrl || DEFAULT_TOSS_API_BASE_URL;

  let parsed: URL;
  try {
    parsed = new URL(rawBaseUrl);
  } catch {
    throw new Error(
      `Invalid environment variable: TOSS_PAYMENTS_API_BASE_URL (${rawBaseUrl})`,
    );
  }

  parsed.pathname = normalizePathname(parsed.pathname);
  return parsed;
}

export function buildTossApiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const baseUrl = resolveBaseUrl();
  const basePath = normalizePathname(baseUrl.pathname);
  const hasV1Prefix =
    basePath.endsWith("/v1") || normalizedPath.startsWith("/v1/");
  const apiPrefix = hasV1Prefix ? "" : "/v1";

  baseUrl.pathname = `${basePath}${apiPrefix}${normalizedPath}`.replace(
    /\/{2,}/g,
    "/",
  );

  return baseUrl.toString();
}

export function createTossBasicAuthorization(secretKey: string): string {
  return `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
}
