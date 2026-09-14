export interface OAuthRedirectResolution {
  redirectTo: string;
  warnings: string[];
}

function toOrigin(rawUrl: string): string | null {
  try {
    return new URL(rawUrl).origin;
  } catch {
    return null;
  }
}

function normalizeCallbackPath(callbackPath: string): string {
  if (callbackPath.startsWith("/")) {
    return callbackPath;
  }
  return `/${callbackPath}`;
}

export function resolveOAuthRedirectUrl({
  runtimeOrigin,
  callbackPath = "/auth/callback",
  configuredSiteUrl,
  configuredAuthRedirectUrl,
}: {
  runtimeOrigin: string;
  callbackPath?: string;
  configuredSiteUrl?: string;
  configuredAuthRedirectUrl?: string;
}): OAuthRedirectResolution {
  const safeRuntimeOrigin = toOrigin(runtimeOrigin);
  if (!safeRuntimeOrigin) {
    throw new Error(`Invalid runtime origin: ${runtimeOrigin}`);
  }

  const safeCallbackPath = normalizeCallbackPath(callbackPath);
  const warnings: string[] = [];

  const explicitRedirect = configuredAuthRedirectUrl?.trim();
  if (explicitRedirect) {
    const explicitOrigin = toOrigin(explicitRedirect);
    if (!explicitOrigin) {
      warnings.push("NEXT_PUBLIC_AUTH_REDIRECT_URL 형식이 올바르지 않습니다.");
    } else if (explicitOrigin !== safeRuntimeOrigin) {
      warnings.push(
        `NEXT_PUBLIC_AUTH_REDIRECT_URL(${explicitOrigin})이 현재 접속 origin(${safeRuntimeOrigin})과 다릅니다.`,
      );
    } else {
      return {
        redirectTo: new URL(safeCallbackPath, explicitRedirect).toString(),
        warnings,
      };
    }
  }

  const siteUrl = configuredSiteUrl?.trim();
  if (siteUrl) {
    const siteOrigin = toOrigin(siteUrl);
    if (!siteOrigin) {
      warnings.push("NEXT_PUBLIC_SITE_URL 형식이 올바르지 않습니다.");
    } else if (siteOrigin !== safeRuntimeOrigin) {
      warnings.push(
        `NEXT_PUBLIC_SITE_URL(${siteOrigin})와 현재 접속 origin(${safeRuntimeOrigin})이 다릅니다.`,
      );
    } else {
      return {
        redirectTo: new URL(safeCallbackPath, siteUrl).toString(),
        warnings,
      };
    }
  }

  return {
    redirectTo: new URL(safeCallbackPath, safeRuntimeOrigin).toString(),
    warnings,
  };
}
