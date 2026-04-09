"use client";

import { useEffect, useState } from "react";

import {
  buildChunkRecoveryUrl,
  resolveChunkFailureAction,
  shouldReloadForChunkFailureFallback,
} from "@/lib/runtime/chunk-reload";

function shouldUseSessionStorage(): boolean {
  return typeof window !== "undefined" && Boolean(window.sessionStorage);
}

function reloadPage() {
  window.location.assign(buildChunkRecoveryUrl(window.location));
}

function tryRecoverFromChunkFailure(
  candidate: unknown,
  onManualRecoveryNeeded: () => void,
): void {
  if (typeof window === "undefined") return;

  let action = resolveChunkFailureAction(candidate, {
    fallbackReload: shouldReloadForChunkFailureFallback,
  });
  try {
    if (shouldUseSessionStorage()) {
      action = resolveChunkFailureAction(candidate, {
        storage: window.sessionStorage,
        fallbackReload: shouldReloadForChunkFailureFallback,
      });
    }
  } catch {
    action = resolveChunkFailureAction(candidate, {
      fallbackReload: shouldReloadForChunkFailureFallback,
    });
  }

  if (action === "reload") {
    reloadPage();
    return;
  }

  if (action === "manual_recovery") {
    onManualRecoveryNeeded();
  }
}

export default function ChunkErrorRecovery() {
  const [showManualRecoveryBanner, setShowManualRecoveryBanner] =
    useState(false);

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      tryRecoverFromChunkFailure(event.error || event.message, () => {
        setShowManualRecoveryBanner(true);
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      tryRecoverFromChunkFailure(event.reason, () => {
        setShowManualRecoveryBanner(true);
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  if (!showManualRecoveryBanner) {
    return null;
  }

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 sm:inset-x-auto sm:right-4 sm:w-[380px]">
      <div className="rounded-2xl border border-orange-200 bg-white/95 p-3 shadow-xl backdrop-blur-sm sm:p-4">
        <p className="text-sm font-semibold text-gray-900">
          페이지 업데이트 감지
        </p>
        <p className="mt-1 text-xs leading-relaxed text-gray-600 sm:text-sm">
          최신 코드 반영 중 충돌이 발생했습니다. 새로고침하면 대부분 즉시
          복구됩니다.
        </p>
        <button
          type="button"
          onClick={reloadPage}
          className="mt-3 w-full rounded-xl bg-orange-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600 sm:w-auto"
        >
          지금 새로고침
        </button>
      </div>
    </div>
  );
}
