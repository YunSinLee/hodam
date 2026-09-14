export const OAUTH_PROVIDER_NAMES = ["google", "kakao"] as const;

export type OAuthProviderName = (typeof OAUTH_PROVIDER_NAMES)[number];

export function normalizeOAuthProviderName(
  value: unknown,
): OAuthProviderName | null {
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();
  if (
    normalized === OAUTH_PROVIDER_NAMES[0] ||
    normalized === OAUTH_PROVIDER_NAMES[1]
  ) {
    return normalized;
  }

  return null;
}
