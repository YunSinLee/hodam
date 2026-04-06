"use client";

import { useEffect } from "react";

import {
  isChunkLoadFailure,
  shouldReloadForChunkFailure,
} from "@/lib/runtime/chunk-reload";

function tryRecoverFromChunkFailure(candidate: unknown): void {
  if (typeof window === "undefined") return;
  if (!isChunkLoadFailure(candidate)) return;

  try {
    if (!shouldReloadForChunkFailure(window.sessionStorage)) {
      return;
    }
  } catch {
    // If sessionStorage is unavailable, keep fail-safe behavior.
  }

  window.location.reload();
}

export default function ChunkErrorRecovery() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      tryRecoverFromChunkFailure(event.error || event.message);
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      tryRecoverFromChunkFailure(event.reason);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
