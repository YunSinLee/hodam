"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useParams, useRouter } from "next/navigation";

import type { MyStoryDetailMessage } from "@/app/components/my-story-detail/my-story-detail-contract";
import type {
  MyStoryDetailHandlers,
  MyStoryDetailPageState,
  MyStoryDetailStatusState,
} from "@/app/my-story/[thread_id]/my-story-detail-contract";
import { ApiError } from "@/lib/client/api/http";
import threadApi, { type ThreadDiagnostics } from "@/lib/client/api/thread";
import { scheduleProtectedPageSignInRedirect } from "@/lib/ui/protected-page-redirect";
import { resolveThreadDetailErrorState } from "@/lib/ui/thread-detail-error";

export default function useMyStoryDetailController() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [ableEnglish, setAbleEnglish] = useState<boolean>(false);
  const [messages, setMessages] = useState<MyStoryDetailMessage[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isShowEnglish, setIsShowEnglish] = useState<boolean>(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<ThreadDiagnostics | null>(
    null,
  );
  const [isPageLoaded, setIsPageLoaded] = useState(false);
  const params = useParams();
  const router = useRouter();
  const signInRedirectCleanupRef = useRef<(() => void) | null>(null);
  const threadId = Number(params?.thread_id);
  const threadIdLabel = String(params?.thread_id || "");

  const fetchThreadDetail = useCallback(async () => {
    if (signInRedirectCleanupRef.current) {
      signInRedirectCleanupRef.current();
      signInRedirectCleanupRef.current = null;
    }

    if (!Number.isFinite(threadId) || threadId <= 0) {
      const invalidState = resolveThreadDetailErrorState(
        new ApiError(400, "Invalid threadId", {
          code: "THREAD_ID_INVALID",
        }),
      );
      setAbleEnglish(false);
      setMessages([]);
      setImageUrl(null);
      setDiagnostics(null);
      setErrorMessage(invalidState.message);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const { detail, diagnostics: nextDiagnostics } =
        await threadApi.getThreadDetailWithDiagnostics(threadId);

      setAbleEnglish(Boolean(detail.thread.able_english));
      setImageUrl(detail.imageUrl);
      setDiagnostics(nextDiagnostics);
      setMessages(
        detail.messages.map(item => ({
          text: item.text,
          text_en: item.text_en,
        })),
      );
    } catch (error) {
      const errorState = resolveThreadDetailErrorState(error);
      setAbleEnglish(false);
      setMessages([]);
      setImageUrl(null);
      setDiagnostics(null);
      setErrorMessage(errorState.message);

      if (errorState.shouldRedirectToSignIn) {
        const nextPath = threadIdLabel
          ? `/my-story/${threadIdLabel}`
          : "/my-story";
        signInRedirectCleanupRef.current = scheduleProtectedPageSignInRedirect({
          router,
          returnPath: nextPath,
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [router, threadId, threadIdLabel]);

  useEffect(() => {
    fetchThreadDetail();

    const timer = setTimeout(() => {
      setIsPageLoaded(true);
    }, 100);
    return () => {
      clearTimeout(timer);
      if (signInRedirectCleanupRef.current) {
        signInRedirectCleanupRef.current();
        signInRedirectCleanupRef.current = null;
      }
    };
  }, [fetchThreadDetail]);

  const handlers: MyStoryDetailHandlers = {
    onRetry: () => {
      fetchThreadDetail().catch(() => undefined);
    },
    onToggleEnglish: () => {
      setIsShowEnglish(prev => !prev);
    },
  };

  const statusState: MyStoryDetailStatusState = {
    isLoading,
    isPageLoaded,
  };

  const pageState: MyStoryDetailPageState = {
    threadId: threadIdLabel,
    ableEnglish,
    isShowEnglish,
    imageUrl,
    messages,
    errorMessage,
    diagnostics,
  };

  return {
    statusState,
    pageState,
    handlers,
  };
}
