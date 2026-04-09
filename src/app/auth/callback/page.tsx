"use client";

import AuthCallbackStatusCard from "@/app/components/auth/AuthCallbackStatusCard";
import AuthShell from "@/app/components/auth/AuthShell";

import useAuthCallbackController from "./useAuthCallbackController";

export default function AuthCallback() {
  const { state, handlers } = useAuthCallbackController();

  return (
    <AuthShell>
      <AuthCallbackStatusCard
        status={state.status}
        message={state.message}
        showManualRecovery={state.showManualRecovery}
        recoveryCode={state.recoveryCode}
        autoRecoveryNotice={state.autoRecoveryNotice}
        showDebugEvents={state.showDebugEvents}
        debugEvents={state.debugEvents}
        debugAttemptId={state.debugAttemptId}
        debugFetchNotice={state.debugFetchNotice}
        onManualRecoveryClick={handlers.onManualRecoveryClick}
        onRetryClick={handlers.onRetryClick}
        onSuccessClick={handlers.onSuccessClick}
        onRefreshDebugEvents={handlers.onRefreshDebugEvents}
      />
    </AuthShell>
  );
}
