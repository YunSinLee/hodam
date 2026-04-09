export type AuthCallbackStatus = "loading" | "success" | "error";

export function getAuthCallbackStatusTitle(status: AuthCallbackStatus): string {
  if (status === "success") {
    return "로그인 성공!";
  }

  if (status === "error") {
    return "로그인 실패";
  }

  return "로그인 처리 중";
}
