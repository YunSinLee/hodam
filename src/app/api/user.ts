import { supabase } from "../utils/supabase";

const userApi = {
  async signUp({ email, password }: { email: string; password: string }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: process.env.NEXT_PUBLIC_SITE_URL,
      },
    });

    if (error) {
      console.error("Error signing up user", error);
    }

    return data;
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
