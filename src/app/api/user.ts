import { safeReturnPath } from "@/app/utils/navigation";
import { savePostLoginRedirectPath } from "@/lib/auth/post-login-redirect";
import clientUserApi from "@/lib/client/api/user";

const userApi = {
  ...clientUserApi,
  async signInWithKakao(next?: string) {
    if (next !== undefined) savePostLoginRedirectPath(safeReturnPath(next));
    return clientUserApi.signInWithKakao();
  },
  async signInWithGoogle(next?: string) {
    if (next !== undefined) savePostLoginRedirectPath(safeReturnPath(next));
    return clientUserApi.signInWithGoogle();
  },
  async signOut() {
    await clientUserApi.signOut();
    try {
      sessionStorage.removeItem("hodam-picturebook-input");
      sessionStorage.removeItem("hodam:post-login-next");
      localStorage.removeItem("hodam-user-info");
      localStorage.removeItem("hodam-bead-info");
    } catch {
      // Signing out still succeeds when storage is disabled.
    }
  },
};

export default userApi;
