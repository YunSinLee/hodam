import { supabase } from "@/app/utils/supabase";
import { resolveOAuthRedirectUrl } from "@/lib/auth/oauth-redirect";

interface SupabaseLikeError {
  message?: string;
  status?: number;
}

const OAUTH_SIGNIN_TIMEOUT_MS = 12000;

function toAuthErrorMessage(
  error: SupabaseLikeError | null | undefined,
  fallback: string,
) {
  const message = error?.message || "";

  if (message === "Invalid login credentials") {
    return "이메일이나 비밀번호가 올바르지 않습니다.";
  }

  if (message === "Email not confirmed") {
    return "이메일 인증을 완료 후, 다시 로그인해주세요.";
  }

  return message || fallback;
}

function toError(
  error: SupabaseLikeError | null | undefined,
  fallback: string,
) {
  return new Error(toAuthErrorMessage(error, fallback));
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`${label} timeout (${timeoutMs}ms)`));
    }, timeoutMs);

    promise
      .then(result => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

function getOAuthRedirectUrl() {
  const { redirectTo } = resolveOAuthRedirectUrl({
    runtimeOrigin: window.location.origin,
    configuredSiteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    configuredAuthRedirectUrl: process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL,
  });

  return redirectTo;
}

async function startOAuthSignIn(provider: "kakao" | "google") {
  const redirectTo = getOAuthRedirectUrl();
  const { data, error } = await withTimeout(
    supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    }),
    OAUTH_SIGNIN_TIMEOUT_MS,
    "OAuth sign-in request",
  );

  if (error) {
    throw error;
  }

  if (data?.url) {
    window.location.assign(data.url);
    return data;
  }

  const fallbackResult = await withTimeout(
    supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
      },
    }),
    OAUTH_SIGNIN_TIMEOUT_MS,
    "OAuth redirect request",
  );

  if (fallbackResult.error) {
    throw fallbackResult.error;
  }

  if (fallbackResult.data?.url) {
    window.location.assign(fallbackResult.data.url);
    return fallbackResult.data;
  }

  throw new Error("OAuth redirect URL을 가져오지 못했습니다.");
}

const userApi = {
  async signUp({
    email,
    password,
    // phone,
  }: {
    email: string;
    password: string;
    // phone: string;
  }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      // phone,
      password,
      options: {
        emailRedirectTo: getOAuthRedirectUrl(),
      },
    });

    return { data, error };
  },
  async signIn({ email, password }: { email: string; password: string }) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw toError(error, "로그인에 실패했습니다.");
    }

    if (!data.user) {
      throw new Error("로그인 사용자 정보를 찾을 수 없습니다.");
    }

    return {
      profileUrl: "",
      id: data.user.id,
      email: data.user.email,
    };
  },
  async signInWithKakao() {
    return startOAuthSignIn("kakao");
  },
  async signInWithGoogle() {
    return startOAuthSignIn("google");
  },
  async signOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw toError(error, "로그아웃에 실패했습니다.");
    }
  },
  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      return null;
    }

    if (data?.session?.user) {
      return {
        profileUrl: "",
        id: data.session.user.id,
        email: data.session.user.email,
      };
    }
    return null;
  },
};

export default userApi;
