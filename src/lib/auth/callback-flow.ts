export interface OAuthCallbackPayload {
  code: string | null;
  oauthError: string | null;
  accessTokenFromHash: string | null;
  refreshTokenFromHash: string | null;
  hasCode: boolean;
  hasTokenPair: boolean;
  hasCallbackPayload: boolean;
}

export type OAuthCodeExchangeAction =
  | "none"
  | "wait_for_existing_exchange"
  | "exchange_now";

export function parseOAuthCallbackPayload(url: URL): OAuthCallbackPayload {
  const { searchParams, hash } = url;
  const hashParams = new URLSearchParams(hash.slice(1));

  const code = searchParams.get("code");
  const oauthError =
    searchParams.get("error_description") ||
    searchParams.get("error") ||
    hashParams.get("error_description") ||
    hashParams.get("error");
  const accessTokenFromHash = hashParams.get("access_token");
  const refreshTokenFromHash = hashParams.get("refresh_token");
  const hasCode = Boolean(code);
  const hasTokenPair = Boolean(accessTokenFromHash && refreshTokenFromHash);

  return {
    code,
    oauthError,
    accessTokenFromHash,
    refreshTokenFromHash,
    hasCode,
    hasTokenPair,
    hasCallbackPayload: hasCode || hasTokenPair || Boolean(oauthError),
  };
}

export function resolveOAuthCodeExchangeAction({
  hasSession,
  code,
  hasRecentCodeMarker,
}: {
  hasSession: boolean;
  code: string | null;
  hasRecentCodeMarker: boolean;
}): OAuthCodeExchangeAction {
  if (hasSession || !code) {
    return "none";
  }

  if (hasRecentCodeMarker) {
    return "wait_for_existing_exchange";
  }

  return "exchange_now";
}
