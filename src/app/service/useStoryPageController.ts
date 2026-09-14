"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import { useRouter } from "next/navigation";

import {
  requestContinueStory,
  requestStartStory,
  requestTranslateStory,
} from "@/app/service/story-page-api";
import {
  StoryAuthenticatedHandlers,
  StoryAuthenticatedState,
  StoryPageFeedback,
  StoryPageStatusState,
  StorySessionHandlers,
  StorySessionState,
} from "@/app/service/story-page-contract";
import {
  toStoryGuardFailureFeedback,
  toStoryRequestErrorFeedback,
} from "@/app/service/story-page-feedback";
import {
  canRequestStoryContinue,
  canRequestStoryTranslate,
} from "@/app/service/story-page-flow";
import {
  getStoryFeedbackActionTarget,
  guardContinueStoryInput,
  guardStartStoryInput,
} from "@/app/service/story-page-guards";
import { resolveStoryPageInitialization } from "@/app/service/story-page-init";
import {
  toContinueStoryPendingState,
  toContinueStorySettledState,
  toStartStoryFailureState,
  toStartStoryPendingState,
  toStartStorySettledState,
  toTranslateStoryPendingState,
  toTranslateStorySettledState,
} from "@/app/service/story-page-lifecycle";
import {
  appendStoryMessages,
  buildStartStoryKeywordsPayload,
  mergeTranslatedStoryMessages,
  toContinueStoryStatePatch,
  toStartStoryStatePatch,
  toTranslateStoryStatePatch,
} from "@/app/service/story-page-state";
import { recoverSessionUserInfo } from "@/lib/auth/session-recovery";
import { resolveSessionUser } from "@/lib/auth/session-user-resolver";
import { calculateStoryStartCost } from "@/lib/story/options";
import { type StoryServiceFeedbackAction } from "@/lib/ui/story-service-error";
import useBead from "@/services/hooks/use-bead";
import useUserInfo from "@/services/hooks/use-user-info";

export default function useStoryPageController() {
  const router = useRouter();
  const mountedRef = useRef(true);
  const [threadId, setThreadId] = useState<number | null>(null);
  const [keywords, setKeywords] = useState<string>("");
  const [messages, setMessages] = useState<StorySessionState["messages"]>([]);
  const [notice, setNotice] = useState<string>("");
  const [selections, setSelections] = useState<StorySessionState["selections"]>(
    [],
  );
  const [isImageLoading, setIsImageLoading] = useState<boolean>(false);
  const [isStoryLoading, setIsStoryLoading] = useState<boolean>(false);
  const [images, setImages] = useState<string[]>([]);
  const [isEnglishIncluded, setIsEnglishIncluded] = useState<boolean>(false);
  const [isShowEnglish, setIsShowEnglish] = useState<boolean>(false);
  const [isImageIncluded, setIsImageIncluded] = useState<boolean>(false);
  const [isStarted, setIsStarted] = useState<boolean>(false);
  const [pageFeedback, setPageFeedback] = useState<StoryPageFeedback | null>(
    null,
  );
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);
  const [translationInProgress, setTranslationInProgress] =
    useState<boolean>(false);
  const [selectedChoice, setSelectedChoice] = useState<string>("");
  const [isSelectionLoading, setIsSelectionLoading] = useState<boolean>(false);

  const { userInfo, setUserInfo, hasHydrated } = useUserInfo();
  const { bead, setBead } = useBead();

  const neededBeadCount = useMemo(
    () =>
      calculateStoryStartCost({
        includeEnglish: isEnglishIncluded,
        includeImage: isImageIncluded,
      }),
    [isEnglishIncluded, isImageIncluded],
  );

  const applyBeadCount = useCallback(
    (nextCount: number) => {
      setBead({
        ...bead,
        count: nextCount,
        user_id: userInfo.id,
      });
    },
    [bead, setBead, userInfo.id],
  );

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const resolveActiveStorySessionUser = useCallback(
    async () =>
      resolveSessionUser({
        currentUser: userInfo,
        recoverSessionUser: () => recoverSessionUserInfo(),
        onRecoveredUser: recoveredUserInfo => {
          setUserInfo(recoveredUserInfo);
        },
      }),
    [setUserInfo, userInfo],
  );

  useEffect(() => {
    let cancelled = false;

    if (userInfo.id) {
      setIsAuthReady(true);
      return () => {
        cancelled = true;
      };
    }

    setIsAuthReady(false);

    const syncSession = async () => {
      const recoveredUserInfo = await resolveActiveStorySessionUser();
      if (cancelled || !mountedRef.current) {
        return;
      }
      const initResult = resolveStoryPageInitialization({
        currentUserId: userInfo.id,
        recoveredUserInfo,
      });
      if (
        initResult.shouldSetRecoveredUserInfo &&
        initResult.recoveredUserInfo
      ) {
        setUserInfo(initResult.recoveredUserInfo);
      }
      setIsAuthReady(true);
    };

    syncSession().catch(() => {
      if (cancelled || !mountedRef.current) {
        return;
      }
      setIsAuthReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [resolveActiveStorySessionUser, setUserInfo, userInfo.id]);

  const onKeywordsChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setKeywords(event.target.value);
    },
    [],
  );

  const onEnglishIncludedChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setIsEnglishIncluded(event.target.checked);
    },
    [],
  );

  const onImageIncludedChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setIsImageIncluded(event.target.checked);
    },
    [],
  );

  const onToggleEnglish = useCallback(() => {
    setIsShowEnglish(prev => !prev);
  }, []);

  const onStartStory = useCallback(async () => {
    setPageFeedback(null);

    const keywordsPayload = buildStartStoryKeywordsPayload(keywords);
    const startGuard = guardStartStoryInput(userInfo.id, keywordsPayload);
    if (!startGuard.ok) {
      setPageFeedback(toStoryGuardFailureFeedback(startGuard));
      return;
    }
    if (!keywordsPayload) {
      return;
    }

    const pendingState = toStartStoryPendingState({
      includeImage: isImageIncluded,
    });
    setIsStarted(pendingState.isStarted);
    setIsStoryLoading(pendingState.isStoryLoading);
    setIsImageLoading(pendingState.isImageLoading);

    try {
      const response = await requestStartStory({
        keywords: keywordsPayload,
        includeEnglish: isEnglishIncluded,
        includeImage: isImageIncluded,
      });
      if (!mountedRef.current) {
        return;
      }

      const nextState = toStartStoryStatePatch(response);
      setThreadId(nextState.threadId);
      setMessages(nextState.messages);
      setSelections(nextState.selections);
      setNotice(nextState.notice);
      setImages(nextState.images);
      applyBeadCount(nextState.beadCount);

      if (nextState.shouldShowEnglish) {
        setIsShowEnglish(true);
      }
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }
      setPageFeedback(toStoryRequestErrorFeedback(error));
      const failureState = toStartStoryFailureState();
      setIsStarted(failureState.isStarted);
    } finally {
      if (mountedRef.current) {
        const settledState = toStartStorySettledState();
        setIsStoryLoading(settledState.isStoryLoading);
        setIsImageLoading(settledState.isImageLoading);
      }
    }
  }, [
    applyBeadCount,
    isEnglishIncluded,
    isImageIncluded,
    keywords,
    userInfo.id,
  ]);

  const onSelectionClick = useCallback(
    async (selection: string) => {
      setPageFeedback(null);

      const continueGuard = guardContinueStoryInput(threadId, selection);
      if (!continueGuard.ok) {
        setPageFeedback(toStoryGuardFailureFeedback(continueGuard));
        return;
      }

      if (!canRequestStoryContinue({ isStoryLoading, isSelectionLoading })) {
        return;
      }
      if (!threadId) {
        return;
      }

      const pendingState = toContinueStoryPendingState(selection);
      setIsSelectionLoading(pendingState.isSelectionLoading);
      setSelectedChoice(pendingState.selectedChoice);
      setIsStoryLoading(pendingState.isStoryLoading);
      setSelections(pendingState.selections);

      try {
        const response = await requestContinueStory({
          threadId,
          selection,
        });
        if (!mountedRef.current) {
          return;
        }

        const nextState = toContinueStoryStatePatch(response);
        setMessages(prev =>
          appendStoryMessages(prev, nextState.incomingMessages),
        );
        setSelections(nextState.selections);
        setNotice(nextState.notice);
        applyBeadCount(nextState.beadCount);
      } catch (error) {
        if (!mountedRef.current) {
          return;
        }
        setPageFeedback(toStoryRequestErrorFeedback(error));
      } finally {
        if (mountedRef.current) {
          const settledState = toContinueStorySettledState();
          setIsStoryLoading(settledState.isStoryLoading);
          setIsSelectionLoading(settledState.isSelectionLoading);
          setSelectedChoice(settledState.selectedChoice);
        }
      }
    },
    [applyBeadCount, isSelectionLoading, isStoryLoading, threadId],
  );

  const onTranslate = useCallback(async () => {
    if (
      !canRequestStoryTranslate({
        isStarted,
        messageCount: messages.length,
        threadId,
      })
    ) {
      return;
    }
    if (!threadId) {
      return;
    }

    setPageFeedback(null);
    const pendingState = toTranslateStoryPendingState();
    setTranslationInProgress(pendingState.translationInProgress);
    try {
      const response = await requestTranslateStory({ threadId });
      if (!mountedRef.current) {
        return;
      }

      const nextState = toTranslateStoryStatePatch(response);
      setMessages(prev =>
        mergeTranslatedStoryMessages(prev, nextState.translatedMessages),
      );
      setIsShowEnglish(nextState.isShowEnglish);
      setIsEnglishIncluded(nextState.isEnglishIncluded);
      applyBeadCount(nextState.beadCount);
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }
      setPageFeedback(toStoryRequestErrorFeedback(error));
    } finally {
      if (mountedRef.current) {
        const settledState = toTranslateStorySettledState();
        setTranslationInProgress(settledState.translationInProgress);
      }
    }
  }, [applyBeadCount, isStarted, messages.length, threadId]);

  const onFeedbackAction = useCallback(
    (action: StoryServiceFeedbackAction) => {
      router.push(getStoryFeedbackActionTarget(action));
    },
    [router],
  );

  const statusState: StoryPageStatusState = {
    hasHydrated: hasHydrated && isAuthReady,
    userId: userInfo.id,
    pageFeedback,
    pageFeedbackAction: pageFeedback?.action || null,
  };

  const sessionState: StorySessionState = {
    isImageIncluded,
    images,
    isImageLoading,
    isStoryLoading,
    isSelectionLoading,
    messages,
    isEnglishIncluded,
    isShowEnglish,
    translationInProgress,
    notice,
    selections,
    selectedChoice,
  };

  const authenticatedState: StoryAuthenticatedState = {
    neededBeadCount,
    keywords,
    isEnglishIncluded,
    isImageIncluded,
    isStoryLoading,
    isImageLoading,
    isStarted,
    session: sessionState,
  };

  const sessionHandlers: StorySessionHandlers = {
    onToggleEnglish,
    onTranslate,
    onSelectionClick,
  };

  const handlers: StoryAuthenticatedHandlers = {
    onKeywordsChange,
    onStartStory,
    onEnglishIncludedChange,
    onImageIncludedChange,
    ...sessionHandlers,
  };

  return {
    statusState,
    authenticatedState,
    handlers,
    onFeedbackAction,
  };
}
