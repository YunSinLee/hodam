import type { OAuthProviderName } from "@/lib/auth/oauth-provider";
import {
  clearOAuthProviderMarker,
  markOAuthProvider,
} from "@/lib/auth/oauth-provider-marker";
import userApi from "@/lib/client/api/user";

interface StartOAuthSignInWithMarkerDeps {
  clearProviderMarker: () => void;
  markProvider: (provider: OAuthProviderName) => string | void;
  signInWithGoogle: () => Promise<unknown>;
  signInWithKakao: () => Promise<unknown>;
  launchTimeoutMs: number;
}

const DEFAULT_OAUTH_LAUNCH_TIMEOUT_MS = 20_000;

const defaultDeps: StartOAuthSignInWithMarkerDeps = {
  clearProviderMarker: clearOAuthProviderMarker,
  markProvider: markOAuthProvider,
  signInWithGoogle: () => userApi.signInWithGoogle(),
  signInWithKakao: () => userApi.signInWithKakao(),
  launchTimeoutMs: DEFAULT_OAUTH_LAUNCH_TIMEOUT_MS,
};

interface OAuthLaunchError extends Error {
  oauthAttemptId?: string;
}

function withOAuthAttemptId(error: unknown, attemptId: string | null): Error {
  if (error instanceof Error) {
    const nextError = error as OAuthLaunchError;
    if (attemptId) {
      nextError.oauthAttemptId = attemptId;
    }
    return nextError;
  }

  const wrappedError = new Error(String(error || "OAuth sign-in failed"));
  if (attemptId) {
    (wrappedError as OAuthLaunchError).oauthAttemptId = attemptId;
  }
  return wrappedError;
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timeout (${timeoutMs}ms)`));
    }, timeoutMs);

    promise
      .then(result => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export async function startOAuthSignInWithMarker(
  provider: OAuthProviderName,
  deps: StartOAuthSignInWithMarkerDeps = defaultDeps,
) {
  const attemptIdResult = deps.markProvider(provider);
  const attemptId =
    typeof attemptIdResult === "string" ? attemptIdResult : null;

  try {
    if (provider === "kakao") {
      await withTimeout(
        deps.signInWithKakao(),
        deps.launchTimeoutMs,
        `${provider} OAuth launch`,
      );
      return;
    }

    await withTimeout(
      deps.signInWithGoogle(),
      deps.launchTimeoutMs,
      `${provider} OAuth launch`,
    );
  } catch (error) {
    // If sign-in launch fails before redirect, prevent stale provider marker.
    deps.clearProviderMarker();
    throw withOAuthAttemptId(error, attemptId);
  }
}
