const POST_LOGIN_REDIRECT_KEY = "hodam:post-login-next";
const MAX_REDIRECT_PATH_LENGTH = 512;

function getSessionStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage || null;
  } catch {
    return null;
  }
}

export function sanitizePostLoginRedirectPath(
  value: string | null | undefined,
): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_REDIRECT_PATH_LENGTH) return null;
  if (!trimmed.startsWith("/")) return null;
  if (trimmed.startsWith("//")) return null;
  if (trimmed.includes("://")) return null;
  if (trimmed.includes("\\")) return null;
  if (trimmed.split("").some(char => char.charCodeAt(0) <= 32)) return null;

  try {
    const url = new URL(trimmed, "https://hodam.local");
    if (
      url.origin !== "https://hodam.local" ||
      url.pathname.startsWith("/auth") ||
      url.pathname === "/sign-in"
    ) {
      return null;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function savePostLoginRedirectPath(path: string): boolean {
  const normalized = sanitizePostLoginRedirectPath(path);
  if (!normalized) return false;

  const storage = getSessionStorage();
  if (!storage) return false;

  try {
    storage.setItem(POST_LOGIN_REDIRECT_KEY, normalized);
    return true;
  } catch {
    return false;
  }
}

export function clearPostLoginRedirectPath(): void {
  const storage = getSessionStorage();
  if (!storage) return;

  try {
    storage.removeItem(POST_LOGIN_REDIRECT_KEY);
  } catch {
    // Ignore storage failures in restricted browser contexts.
  }
}

export function consumePostLoginRedirectPath(
  defaultPath: string = "/",
): string {
  const path = readPostLoginRedirectPath(defaultPath);
  clearPostLoginRedirectPath();
  return path;
}

export function readPostLoginRedirectPath(defaultPath: string = "/"): string {
  const fallbackPath = sanitizePostLoginRedirectPath(defaultPath) || "/";
  const storage = getSessionStorage();
  if (!storage) return fallbackPath;

  let savedPath: string | null = null;
  try {
    savedPath = storage.getItem(POST_LOGIN_REDIRECT_KEY);
  } catch {
    return fallbackPath;
  }

  return sanitizePostLoginRedirectPath(savedPath) || fallbackPath;
}

export const postLoginRedirectInternal = {
  POST_LOGIN_REDIRECT_KEY,
};
