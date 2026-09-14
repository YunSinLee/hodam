import { safeReturnPath } from "../utils/navigation";
import { supabase } from "../utils/supabase";

async function signInWithProvider(provider: "kakao" | "google", next: string) {
  const redirectTo = new URL("/auth/callback", window.location.origin);
  redirectTo.searchParams.set("next", safeReturnPath(next));
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: redirectTo.toString() },
  });
  if (error) throw error;
  return data;
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
  async signInWithKakao(next = "/service") {
    return signInWithProvider("kakao", next);
  },
  async signInWithGoogle(next = "/service") {
    return signInWithProvider("google", next);
  },
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    try {
      sessionStorage.removeItem("hodam-picturebook-input");
      localStorage.removeItem("hodam-user-info");
      localStorage.removeItem("hodam-bead-info");
    } catch {
      /* Signing out still succeeds when storage is disabled. */
    }
  },
  async getSession() {
    const { data } = await supabase.auth.getSession();

    if (data?.session?.user) {
      const userData = {
        profileUrl: "",
        id: data.session.user.id,
        email: data.session.user.email,
      };

      return userData;
    }
    return null;
  },
  async updateUserProfile(
    userId: string,
    updates: { display_name?: string; email?: string },
  ) {
    const { data, error } = await supabase
      .from("users")
      .update(updates)
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      console.error("Error updating user profile:", error);
      throw error;
    }

    return data;
  },
  async getUserProfile(userId: string) {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Error fetching user profile:", error);
      return null;
    }

    return data;
  },
};

export default userApi;
