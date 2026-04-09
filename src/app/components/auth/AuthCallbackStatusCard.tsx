import type { AuthCallbackMetricPayload } from "@/app/auth/callback/auth-callback-metric-contract";
import AuthBrandMark from "@/app/components/auth/AuthBrandMark";
import AuthCard from "@/app/components/auth/AuthCard";
import AuthStatusIcon from "@/app/components/auth/AuthStatusIcon";
import type { SignInRecoveryCode } from "@/lib/auth/callback-error";
import {
  getAuthCallbackStatusTitle,
  type AuthCallbackStatus,
} from "@/lib/auth/callback-status";

interface AuthCallbackStatusCardProps {
  status: AuthCallbackStatus;
  message: string;
  showManualRecovery: boolean;
  recoveryCode: SignInRecoveryCode;
  autoRecoveryNotice?: string | null;
  onManualRecoveryClick: () => void;
  onRetryClick: (code: SignInRecoveryCode) => void;
  onSuccessClick?: () => void;
  showDebugEvents?: boolean;
  debugEvents?: AuthCallbackMetricPayload[];
  debugAttemptId?: string | null;
  debugFetchNotice?: string | null;
  onRefreshDebugEvents?: () => void;
}

export default function AuthCallbackStatusCard({
  status,
  message,
  showManualRecovery,
  recoveryCode,
  autoRecoveryNotice = null,
  onManualRecoveryClick,
  onRetryClick,
  onSuccessClick,
  showDebugEvents = false,
  debugEvents = [],
  debugAttemptId = null,
  debugFetchNotice = null,
  onRefreshDebugEvents,
}: AuthCallbackStatusCardProps) {
  return (
    <AuthCard className="w-full text-center">
      <AuthBrandMark className="mb-6" />

      <div className="mb-6 flex justify-center">
        <AuthStatusIcon status={status} />
      </div>

      <h2 className="mb-2 text-lg font-semibold text-gray-800 sm:text-xl">
        {getAuthCallbackStatusTitle(status)}
      </h2>
      <p className="mb-6 text-sm text-gray-600 sm:text-base">{message}</p>

      {status === "error" && autoRecoveryNotice && (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 sm:text-sm">
          {autoRecoveryNotice}
        </p>
      )}

      {status === "loading" && showManualRecovery && (
        <button
          type="button"
          onClick={onManualRecoveryClick}
          className="mb-4 w-full rounded-2xl border border-amber-300 bg-amber-50 px-5 py-3 text-sm font-medium text-amber-700 transition-all duration-300 hover:bg-amber-100 sm:text-base"
        >
          로그인이 오래 걸리면 다시 시도하기
        </button>
      )}

      {status === "error" && (
        <button
          type="button"
          onClick={() => onRetryClick(recoveryCode)}
          className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-3 text-sm font-semibold text-white transition-all duration-300 hover:from-orange-600 hover:to-amber-600 sm:text-base"
        >
          다시 로그인하기
        </button>
      )}

      {status === "success" && onSuccessClick && (
        <button
          type="button"
          onClick={onSuccessClick}
          className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-3 text-sm font-semibold text-white transition-all duration-300 hover:from-orange-600 hover:to-amber-600 sm:text-base"
        >
          계속하기
        </button>
      )}

      {showDebugEvents && (
        <details className="mt-4 rounded-xl border border-orange-100 bg-orange-50/70 p-3 text-left">
          <summary className="cursor-pointer text-sm font-semibold text-orange-700">
            디버그 이벤트 ({debugEvents.length})
          </summary>
          {debugAttemptId && (
            <p className="mt-2 text-xs text-orange-800">
              시도 ID: <span className="font-mono">{debugAttemptId}</span>
            </p>
          )}
          {debugFetchNotice && (
            <p className="mt-1 text-xs text-orange-700">{debugFetchNotice}</p>
          )}
          {onRefreshDebugEvents && (
            <button
              type="button"
              onClick={onRefreshDebugEvents}
              className="mt-2 rounded-lg border border-orange-200 bg-white px-2 py-1 text-xs font-medium text-orange-700 transition-colors hover:bg-orange-100"
            >
              최근 이벤트 다시 조회
            </button>
          )}
          <ul className="mt-2 max-h-52 space-y-2 overflow-auto pr-1">
            {debugEvents
              .slice(-20)
              .reverse()
              .map(event => (
                <li
                  key={`${event.timestampMs}-${event.stage}-${event.callbackPath}`}
                  className="rounded-lg bg-white px-2 py-1 text-xs text-gray-700"
                >
                  <span className="font-mono text-[11px] text-gray-500">
                    {event.timestampMs}
                  </span>{" "}
                  <span className="font-semibold text-orange-700">
                    {event.stage}
                  </span>
                </li>
              ))}
            {debugEvents.length === 0 && (
              <li className="text-xs text-gray-500">
                아직 수집된 이벤트가 없습니다.
              </li>
            )}
          </ul>
        </details>
      )}
    </AuthCard>
  );
}
