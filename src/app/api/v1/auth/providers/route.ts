import { NextRequest } from "next/server";

import { resolveOAuthRedirectUrl } from "@/lib/auth/oauth-redirect";
import { logError } from "@/lib/server/logger";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { createApiRequestContext } from "@/lib/server/request-context";

type OAuthProvider = "google" | "kakao";

type ProviderStatus = {
  enabled: boolean | null;
  reason?: string;
};

type ProviderStatusMap = Record<OAuthProvider, ProviderStatus>;

const OAUTH_PROVIDERS: OAuthProvider[] = ["google", "kakao"];

function getRateLimitKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const candidate = (forwarded?.split(",")[0] || realIp || "").trim();
  return candidate || "unknown";
}

function createDefaultProviderStatuses(
  enabled: boolean | null,
  reason?: string,
): ProviderStatusMap {
  return {
    google: {
      enabled,
      reason,
    },
    kakao: {
      enabled,
      reason,
    },
  };
}

function extractExternalProviderMap(
  settingsPayload: unknown,
): Record<string, unknown> {
  if (!settingsPayload || typeof settingsPayload !== "object") {
    return {};
  }

  const payload = settingsPayload as Record<string, unknown>;
  const candidates = [
    payload.external,
    payload.external_providers,
    payload.providers,
  ];

  const matchedCandidate = candidates.find(
    candidate =>
      candidate && typeof candidate === "object" && !Array.isArray(candidate),
  );
  if (matchedCandidate) {
    return matchedCandidate as Record<string, unknown>;
  }

  return {};
}

function resolveProviderStatuses(externalProviders: Record<string, unknown>) {
  return OAUTH_PROVIDERS.reduce<ProviderStatusMap>((acc, provider) => {
    const rawValue = externalProviders[provider];
    if (typeof rawValue === "boolean") {
      acc[provider] = rawValue
        ? { enabled: true }
        : {
            enabled: false,
            reason: "disabled_in_supabase_auth_settings",
          };
      return acc;
    }

    acc[provider] = {
      enabled: false,
      reason: "missing_in_supabase_auth_settings",
    };
    return acc;
  }, createDefaultProviderStatuses(false));
}

export async function GET(request: NextRequest) {
  const { failWithCode, ok, requestId } = createApiRequestContext(request);
  const rateLimitKey = getRateLimitKey(request);

  if (!checkRateLimit(`auth:providers:${rateLimitKey}`, 120, 60_000)) {
    return failWithCode(
      429,
      "Too many auth provider diagnostics requests",
      "AUTH_PROVIDERS_RATE_LIMITED",
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";

  let redirectTo: string | null = null;
  let redirectWarnings: string[] = [];
  try {
    const redirectResolution = resolveOAuthRedirectUrl({
      runtimeOrigin: request.nextUrl.origin,
      configuredSiteUrl: process.env.NEXT_PUBLIC_SITE_URL,
      configuredAuthRedirectUrl: process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL,
    });
    redirectTo = redirectResolution.redirectTo;
    redirectWarnings = redirectResolution.warnings;
  } catch (error) {
    redirectWarnings = [
      `OAuth redirect URL 계산 실패: ${
        error instanceof Error ? error.message : String(error)
      }`,
    ];
  }

  const baseResponse = {
    runtimeOrigin: request.nextUrl.origin,
    redirectTo,
    warnings: redirectWarnings,
    checkedAt: new Date().toISOString(),
  };

  if (!supabaseUrl || !anonKey) {
    return ok({
      ...baseResponse,
      warnings: [
        ...redirectWarnings,
        "NEXT_PUBLIC_SUPABASE_URL 또는 NEXT_PUBLIC_SUPABASE_ANON_KEY가 누락되어 provider 상태를 확인할 수 없습니다.",
      ],
      settingsReachable: false,
      settingsStatus: null,
      allEnabled: false,
      providers: createDefaultProviderStatuses(
        null,
        "auth_settings_public_env_missing",
      ),
    });
  }

  try {
    const settingsResponse = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      method: "GET",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      cache: "no-store",
    });
    const bodyText = await settingsResponse.text();
    let payload: unknown = null;
    try {
      payload = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      payload = null;
    }

    if (!settingsResponse.ok) {
      return ok({
        ...baseResponse,
        settingsReachable: false,
        settingsStatus: settingsResponse.status,
        allEnabled: false,
        providers: createDefaultProviderStatuses(
          null,
          "auth_settings_http_error",
        ),
      });
    }

    const statuses = resolveProviderStatuses(
      extractExternalProviderMap(payload),
    );
    const allEnabled = OAUTH_PROVIDERS.every(
      provider => statuses[provider].enabled === true,
    );

    return ok({
      ...baseResponse,
      settingsReachable: true,
      settingsStatus: settingsResponse.status,
      allEnabled,
      providers: statuses,
    });
  } catch (error) {
    logError("/api/v1/auth/providers settings fetch failed", error, {
      requestId,
      runtimeOrigin: request.nextUrl.origin,
    });
    return ok({
      ...baseResponse,
      settingsReachable: false,
      settingsStatus: null,
      allEnabled: false,
      providers: createDefaultProviderStatuses(
        null,
        "auth_settings_fetch_failed",
      ),
    });
  }
}
