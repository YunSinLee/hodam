import { supabase } from "../utils/supabase";
import { NextResponse } from "next/server";
// The client you created from the Server-Side Auth instructions

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const forwardedHost = request.headers.get("x-forwarded-host"); // original origin before load balancer
      const isLocalEnv = process.env.NODE_ENV === "development";
      if (isLocalEnv) {
        // we can be sure that there is no load balancer in between, so no need to watch for X-Forwarded-Host
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
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
        emailRedirectTo: process.env.NEXT_PUBLIC_SITE_URL,
      },
    });

    return { data, error };
  },
  async signIn({ email, password }: { email: string; password: string }) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error && error.status === 400) {
      if (error.message === "Invalid login credentials") {
        alert("이메일이나 비밀번호가 올바르지 않습니다.");
      } else if (error.message === "Email not confirmed") {
        alert("이메일 인증을 완료 후, 다시 로그인해주세요.");
      } else {
        console.error("Error signing in user", error);
      }
      throw new Error("로그인 실패");
    }

    if (data) {
      const userData = {
        profileUrl: "",
        id: data.user?.id,
        email: data.user?.email,
      };

      return userData;
    }
  },
  async signInWithKakao() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "kakao",
      // options: {
      //   redirectTo: "http://localhost:3000/",
      // },
    });

    if (error) {
      console.error("Google Sign In Error:", error.message);
    }

    return data.url;
  },
  async signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
    });
    if (error) {
      console.error("Google Sign In Error:", error.message);
    }

    return data.url;
  },
  async signOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Error signing out user", error);
    } else {
      console.log("User signed out");
    }
  },
  async getSession() {
    const { data } = await supabase.auth.getSession();

    if (data) {
      const userData = {
        profileUrl: "",
        id: data.session?.user?.id,
        email: data.session?.user?.email,
      };

      return userData;
    }
  },
};

export default userApi;
