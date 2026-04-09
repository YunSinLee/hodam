export type OAuthProvider = "kakao" | "google";

export interface OAuthProviderHealthItem {
  enabled?: boolean | null;
  reason?: string;
}

export interface OAuthProviderAvailability {
  availability: Record<OAuthProvider, boolean>;
  providerWarnings: Record<OAuthProvider, string | null>;
  warnings: string[];
}

const OAUTH_PROVIDER_LABEL: Record<OAuthProvider, string> = {
  kakao: "카카오",
  google: "구글",
};

const REASON_MESSAGE_MAP: Record<string, string> = {
  disabled_in_supabase_auth_settings:
    "Supabase Auth 설정에서 비활성화되어 있습니다.",
  missing_in_supabase_auth_settings:
    "Supabase Auth 설정에서 provider 구성이 확인되지 않았습니다.",
  auth_settings_http_error:
    "Supabase Auth 설정 조회가 실패했습니다. 잠시 후 다시 시도해주세요.",
  auth_settings_fetch_failed:
    "Supabase Auth 설정 연결이 불안정합니다. 잠시 후 다시 시도해주세요.",
};

function normalizeWarningText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function toReasonMessage(reason: unknown): string | null {
  const normalized = normalizeWarningText(reason);
  if (!normalized) return null;
  return REASON_MESSAGE_MAP[normalized] || normalized;
}

function parseProviderItem(
  providers: unknown,
  provider: OAuthProvider,
): OAuthProviderHealthItem {
  if (!providers || typeof providers !== "object") {
    return {};
  }

  const rawItem = (providers as Record<string, unknown>)[provider];
  if (!rawItem || typeof rawItem !== "object") {
    return {};
  }

  const item = rawItem as Record<string, unknown>;
  return {
    enabled:
      typeof item.enabled === "boolean" || item.enabled === null
        ? item.enabled
        : undefined,
    reason: normalizeWarningText(item.reason) || undefined,
  };
}

export function normalizeOAuthProviderAvailability(
  payload: unknown,
): OAuthProviderAvailability {
  const availability: Record<OAuthProvider, boolean> = {
    kakao: true,
    google: true,
  };
  const providerWarnings: Record<OAuthProvider, string | null> = {
    kakao: null,
    google: null,
  };
  const warningSet = new Set<string>();

  if (!payload || typeof payload !== "object") {
    return {
      availability,
      providerWarnings,
      warnings: [],
    };
  }

  const payloadObject = payload as Record<string, unknown>;
  const warningsRaw = payloadObject.warnings;
  if (Array.isArray(warningsRaw)) {
    warningsRaw.forEach(item => {
      const warning = normalizeWarningText(item);
      if (warning) {
        warningSet.add(warning);
      }
    });
  }

  const providersRaw = payloadObject.providers;
  (["kakao", "google"] as const).forEach(provider => {
    const item = parseProviderItem(providersRaw, provider);
    if (item.enabled === false) {
      availability[provider] = false;
      const reasonMessage = toReasonMessage(item.reason);
      const warningMessage =
        reasonMessage || "로그인이 현재 비활성화되어 있습니다.";
      providerWarnings[provider] = warningMessage;
      if (reasonMessage) {
        warningSet.add(
          `${OAUTH_PROVIDER_LABEL[provider]} 로그인: ${reasonMessage}`,
        );
      } else {
        warningSet.add(
          `${OAUTH_PROVIDER_LABEL[provider]} 로그인이 현재 비활성화되어 있습니다.`,
        );
      }
      return;
    }

    if (item.enabled === null) {
      const reasonMessage = toReasonMessage(item.reason);
      if (reasonMessage) {
        warningSet.add(
          `${OAUTH_PROVIDER_LABEL[provider]} 로그인 상태 확인 실패: ${reasonMessage}`,
        );
      }
    }
  });

  return {
    availability,
    providerWarnings,
    warnings: Array.from(warningSet),
  };
}
