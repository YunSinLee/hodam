import type { AuthCallbackMetricPayload } from "@/app/auth/callback/auth-callback-metric-contract";
import type { SignInRecoveryCode } from "@/lib/auth/callback-error";
import type { AuthCallbackStatus } from "@/lib/auth/callback-status";

export interface AuthCallbackPageState {
  status: AuthCallbackStatus;
  message: string;
  showManualRecovery: boolean;
  recoveryCode: SignInRecoveryCode;
  autoRecoveryNotice: string | null;
  showDebugEvents: boolean;
  debugEvents: AuthCallbackMetricPayload[];
  debugAttemptId: string | null;
  debugFetchNotice: string | null;
}

export interface AuthCallbackPageHandlers {
  onManualRecoveryClick: () => void;
  onRetryClick: (code: SignInRecoveryCode) => void;
  onSuccessClick: () => void;
  onRefreshDebugEvents: () => void;
}
