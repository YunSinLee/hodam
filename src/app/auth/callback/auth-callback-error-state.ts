import {
  toSignInRecoveryCode,
  type SignInRecoveryCode,
} from "@/lib/auth/callback-error";

export const AUTH_CALLBACK_LOADING_TIMEOUT_MESSAGE =
  "로그인 처리가 지연되고 있습니다. 다시 로그인해주세요.";

export interface AuthCallbackErrorState {
  message: string;
  recoveryCode: SignInRecoveryCode;
}

export function resolveUnexpectedAuthCallbackError(
  error: unknown,
): AuthCallbackErrorState {
  if (error instanceof Error) {
    const isTimeout = error.message.includes("timeout");
    if (isTimeout) {
      return {
        message:
          "로그인 응답이 지연되고 있습니다. 잠시 후 다시 로그인해주세요.",
        recoveryCode: "timeout",
      };
    }

    return {
      message: `로그인 처리 중 오류가 발생했습니다. (${error.message})`,
      recoveryCode: toSignInRecoveryCode(error.message),
    };
  }

  return {
    message: "예상치 못한 오류가 발생했습니다.",
    recoveryCode: "callback_failed",
  };
}
