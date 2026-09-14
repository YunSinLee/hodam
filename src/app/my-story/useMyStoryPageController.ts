"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import type {
  MyStoryBannerState,
  MyStoryHandlers,
  MyStoryPageState,
} from "@/app/my-story/my-story-contract";
import {
  createMyStorySignInRequiredError,
  resolveMyStoryInitialization,
} from "@/app/my-story/my-story-init";
import { resolveMyStorySessionUser } from "@/app/my-story/my-story-session-user";
import { resolveMyStoryThreadListFeedback } from "@/app/my-story/my-story-thread-list-feedback";
import type { ThreadWithUser } from "@/app/types/openai";
import { recoverSessionUserInfo } from "@/lib/auth/session-recovery";
import { buildSignInRedirectPath } from "@/lib/auth/sign-in-redirect";
import threadApi from "@/lib/client/api/thread";
import { scheduleProtectedPageSignInRedirect } from "@/lib/ui/protected-page-redirect";
import { resolveThreadListErrorState } from "@/lib/ui/thread-list-error";
import useUserInfo from "@/services/hooks/use-user-info";

export default function useMyStoryPageController() {
  const mountedRef = useRef(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);
  const [threads, setThreads] = useState<ThreadWithUser[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [isPageLoaded, setIsPageLoaded] = useState(false);
  const [shouldRedirectToSignIn, setShouldRedirectToSignIn] =
    useState<boolean>(false);
  const { userInfo, setUserInfo } = useUserInfo();
  const router = useRouter();

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const resolveActiveSessionUser = useCallback(
    async () =>
      resolveMyStorySessionUser({
        currentUser: userInfo,
        recoverSessionUser: () => recoverSessionUserInfo(),
        onRecoveredUser: recoveredUserInfo => {
          setUserInfo(recoveredUserInfo);
        },
      }),
    [setUserInfo, userInfo],
  );

  const fetchThreadsByUserId = useCallback(async () => {
    setIsLoading(true);
    setIsAuthReady(false);
    setErrorMessage(null);
    setWarningMessage(null);
    setShouldRedirectToSignIn(false);

    try {
      const recoveredUserInfo = await resolveActiveSessionUser();
      if (!mountedRef.current) {
        return;
      }

      const initResult = resolveMyStoryInitialization({
        currentUserId: userInfo.id,
        recoveredUserInfo,
      });
      if (
        initResult.shouldSetRecoveredUserInfo &&
        initResult.recoveredUserInfo
      ) {
        setUserInfo(initResult.recoveredUserInfo);
      }

      if (!mountedRef.current) {
        return;
      }
      setIsAuthReady(true);
      if (initResult.mode === "unauthenticated") {
        const signInRequiredError = createMyStorySignInRequiredError();
        setThreads([]);
        setErrorMessage(signInRequiredError.message);
        setShouldRedirectToSignIn(true);
        return;
      }

      const { threads: nextThreads, diagnostics } =
        await threadApi.fetchThreadsByUserIdWithDiagnostics();
      if (!mountedRef.current) {
        return;
      }
      setThreads(nextThreads);
      const feedback = resolveMyStoryThreadListFeedback(
        {
          threads: nextThreads,
          diagnostics,
        },
        {
          isDevelopment: process.env.NODE_ENV === "development",
        },
      );
      setErrorMessage(feedback.errorMessage);
      setWarningMessage(feedback.warningMessage);
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }
      setIsAuthReady(true);
      setThreads([]);
      setWarningMessage(null);
      const errorState = resolveThreadListErrorState(error);
      setErrorMessage(errorState.message);
      setShouldRedirectToSignIn(errorState.shouldRedirectToSignIn);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [resolveActiveSessionUser, setUserInfo, userInfo.id]);

  const redirectToSignIn = useCallback(() => {
    router.replace(buildSignInRedirectPath("/my-story"));
  }, [router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsPageLoaded(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    fetchThreadsByUserId();
  }, [fetchThreadsByUserId]);

  useEffect(() => {
    if (!shouldRedirectToSignIn) return undefined;
    return scheduleProtectedPageSignInRedirect({
      router,
      returnPath: "/my-story",
    });
  }, [router, shouldRedirectToSignIn]);

  const onErrorAction = useCallback(() => {
    if (shouldRedirectToSignIn) {
      redirectToSignIn();
      return;
    }
    fetchThreadsByUserId().catch(() => undefined);
  }, [fetchThreadsByUserId, redirectToSignIn, shouldRedirectToSignIn]);

  const pageState: MyStoryPageState = {
    isLoading,
    isAuthReady,
    isPageLoaded,
    threads,
  };

  const bannerState: MyStoryBannerState = {
    error: errorMessage
      ? {
          message: errorMessage,
          actionLabel: shouldRedirectToSignIn ? "다시 로그인" : "다시 시도",
        }
      : null,
    warningMessage,
  };

  const handlers: MyStoryHandlers = {
    onErrorAction,
  };

  return {
    pageState,
    bannerState,
    handlers,
  };
}
