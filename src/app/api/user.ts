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
};

export default userApi;
