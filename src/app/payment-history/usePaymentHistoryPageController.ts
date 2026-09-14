"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import type {
  PaymentHistoryErrorActionType,
  PaymentHistoryErrorHandlers,
  PaymentHistoryErrorState,
  PaymentHistoryFilterHandlers,
  PaymentHistoryFilterState,
  PaymentHistoryFormatters,
  PaymentHistoryListHandlers,
  PaymentHistoryListState,
  PaymentHistoryPageHandlers,
  PaymentHistoryPageState,
  PaymentHistoryStatsState,
  PaymentTimelinePanelHandlers,
  PaymentTimelinePanelState,
} from "@/app/payment-history/payment-history-contract";
import {
  createPaymentHistorySignInRequiredState,
  resolvePaymentHistoryInitialization,
} from "@/app/payment-history/payment-history-init";
import {
  normalizeTimelineId,
  parseTimelineRequestKey,
  toTimelineRequestKey,
} from "@/app/payment-history/payment-history-timeline-key";
import { recoverSessionUserInfo } from "@/lib/auth/session-recovery";
import { buildSignInRedirectPath } from "@/lib/auth/sign-in-redirect";
import paymentApi, {
  type PaymentHistory,
  type PaymentTimeline,
} from "@/lib/client/api/payment";
import {
  filterPaymentHistory,
  getCompletedPaymentTotals,
  parsePaymentHistoryTimelineQuery,
  type PaymentHistoryFilter,
} from "@/lib/ui/payment-history";
import {
  getProtectedPageFeedbackAction,
  resolveProtectedPageErrorState,
} from "@/lib/ui/protected-page-error";
import { scheduleProtectedPageSignInRedirect } from "@/lib/ui/protected-page-redirect";
import useUserInfo from "@/services/hooks/use-user-info";

export default function usePaymentHistoryPageController() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userInfo, setUserInfo } = useUserInfo();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [payments, setPayments] = useState<PaymentHistory[]>([]);
  const [filter, setFilter] = useState<PaymentHistoryFilter>("all");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorActionType, setErrorActionType] =
    useState<PaymentHistoryErrorActionType | null>(null);
  const [errorActionLabel, setErrorActionLabel] = useState<string | undefined>(
    undefined,
  );
  const [shouldRedirectToSignIn, setShouldRedirectToSignIn] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedTimelineKey, setSelectedTimelineKey] = useState<string | null>(
    null,
  );
  const [selectedTimelineFlowId, setSelectedTimelineFlowId] = useState<
    string | null
  >(null);
  const [timelineLoadingOrderId, setTimelineLoadingOrderId] = useState<
    string | null
  >(null);
  const [timelineByRequestKey, setTimelineByRequestKey] = useState<
    Record<string, PaymentTimeline>
  >({});
  const [timelineErrorByRequestKey, setTimelineErrorByRequestKey] = useState<
    Record<string, string | undefined>
  >({});
  const [consumedDeepLinkKey, setConsumedDeepLinkKey] = useState<string | null>(
    null,
  );

  const loadPaymentHistory = useCallback(
    async (resolvedUserId?: string) => {
      const activeUserId = resolvedUserId || userInfo.id;
      if (!activeUserId) return;

      try {
        setIsLoading(true);
        setErrorMessage(null);
        setErrorActionType(null);
        setErrorActionLabel(undefined);
        setShouldRedirectToSignIn(false);

        const data = await paymentApi.getPaymentHistory();
        setPayments(data);
      } catch (error) {
        const errorState = resolveProtectedPageErrorState(
          error,
          "결제 내역을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
        );
        const action = getProtectedPageFeedbackAction(errorState);
        setErrorMessage(errorState.message);
        setErrorActionType(action.type);
        setErrorActionLabel(action.label);
        setShouldRedirectToSignIn(errorState.shouldRedirectToSignIn);
      } finally {
        setIsLoading(false);
      }
    },
    [userInfo.id],
  );

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      setIsAuthReady(false);

      const recoveredUserInfo = userInfo.id
        ? null
        : await recoverSessionUserInfo();
      if (cancelled) return;

      const initResult = resolvePaymentHistoryInitialization({
        currentUserId: userInfo.id,
        recoveredUserInfo,
      });

      if (initResult.mode === "unauthenticated") {
        const signInRequiredState = createPaymentHistorySignInRequiredState();
        setIsLoading(false);
        setIsAuthReady(true);
        setErrorMessage(signInRequiredState.message);
        setErrorActionType(signInRequiredState.actionType);
        setErrorActionLabel(signInRequiredState.actionLabel);
        setShouldRedirectToSignIn(signInRequiredState.shouldRedirectToSignIn);
        return;
      }

      if (
        initResult.shouldSetRecoveredUserInfo &&
        initResult.recoveredUserInfo
      ) {
        setUserInfo(initResult.recoveredUserInfo);
      }
      setIsAuthReady(true);
      await loadPaymentHistory(initResult.userId || undefined);
    };

    initialize();

    return () => {
      cancelled = true;
    };
  }, [loadPaymentHistory, setUserInfo, userInfo.id]);

  useEffect(() => {
    if (!shouldRedirectToSignIn) return undefined;

    return scheduleProtectedPageSignInRedirect({
      router,
      returnPath: "/payment-history",
    });
  }, [router, shouldRedirectToSignIn]);

  const onBack = useCallback(() => {
    router.back();
  }, [router]);

  const onGoBead = useCallback(() => {
    router.push("/bead");
  }, [router]);

  const onGoSignIn = useCallback(() => {
    router.replace(buildSignInRedirectPath("/payment-history"));
  }, [router]);

  const onErrorAction = useCallback(() => {
    if (errorActionType === "goSignIn") {
      onGoSignIn();
      return;
    }

    loadPaymentHistory().catch(() => undefined);
  }, [errorActionType, loadPaymentHistory, onGoSignIn]);

  const loadPaymentTimeline = useCallback(
    async (
      orderId?: string | null,
      paymentFlowId?: string | null,
      options: { forceRefresh?: boolean } = {},
    ) => {
      const normalizedOrderId = normalizeTimelineId(orderId);
      const normalizedPaymentFlowId = normalizeTimelineId(paymentFlowId);
      const requestKey = toTimelineRequestKey(
        normalizedOrderId,
        normalizedPaymentFlowId,
      );
      if (!requestKey) return;

      setSelectedTimelineKey(requestKey);
      setSelectedOrderId(normalizedOrderId || null);
      setSelectedTimelineFlowId(normalizedPaymentFlowId || null);
      if (!options.forceRefresh && timelineByRequestKey[requestKey]) {
        const cached = timelineByRequestKey[requestKey];
        setTimelineErrorByRequestKey(prev => ({
          ...prev,
          [requestKey]: undefined,
        }));
        if (cached.orderId) {
          setSelectedOrderId(cached.orderId);
        }
        if (cached.paymentFlowId) {
          setSelectedTimelineFlowId(cached.paymentFlowId);
        }
        return;
      }

      setTimelineLoadingOrderId(requestKey);
      setTimelineErrorByRequestKey(prev => ({
        ...prev,
        [requestKey]: undefined,
      }));

      try {
        const timeline = await paymentApi.getPaymentTimeline(
          {
            orderId: normalizedOrderId || undefined,
            paymentFlowId: normalizedPaymentFlowId || undefined,
          },
          {
            paymentFlowId: normalizedPaymentFlowId || undefined,
          },
        );
        const responseOrderId = normalizeTimelineId(timeline.orderId);
        const responseKey = toTimelineRequestKey(
          responseOrderId,
          timeline.paymentFlowId,
        );
        const responseFlowId = normalizeTimelineId(timeline.paymentFlowId);
        setTimelineByRequestKey(prev => {
          const next = {
            ...prev,
            [requestKey]: timeline,
          };
          if (responseKey) {
            next[responseKey] = timeline;
          }
          return next;
        });
        if (responseOrderId) {
          setSelectedOrderId(responseOrderId);
        }
        if (responseFlowId) {
          setSelectedTimelineFlowId(responseFlowId);
        }
        setSelectedTimelineKey(responseKey || requestKey);
      } catch (error) {
        const errorState = resolveProtectedPageErrorState(
          error,
          "결제 타임라인을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
        );
        setTimelineErrorByRequestKey(prev => ({
          ...prev,
          [requestKey]: errorState.message,
        }));

        if (errorState.shouldRedirectToSignIn) {
          setErrorMessage(errorState.message);
          setErrorActionType("goSignIn");
          setErrorActionLabel("다시 로그인");
          setShouldRedirectToSignIn(true);
        }
      } finally {
        setTimelineLoadingOrderId(current =>
          current === requestKey ? null : current,
        );
      }
    },
    [timelineByRequestKey],
  );

  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat("ko-KR").format(amount);
  }, []);

  const filteredPayments = useMemo(
    () => filterPaymentHistory(payments, filter),
    [filter, payments],
  );
  const timelineQuery = useMemo(
    () => parsePaymentHistoryTimelineQuery(searchParams),
    [searchParams],
  );
  const timelineQueryKey = timelineQuery
    ? toTimelineRequestKey(timelineQuery.orderId, timelineQuery.paymentFlowId)
    : null;

  useEffect(() => {
    if (!isAuthReady || isLoading) return;
    if (!timelineQuery || !timelineQueryKey) return;
    if (consumedDeepLinkKey === timelineQueryKey) return;

    setConsumedDeepLinkKey(timelineQueryKey);
    loadPaymentTimeline(
      timelineQuery.orderId,
      timelineQuery.paymentFlowId,
    ).catch(() => undefined);
  }, [
    consumedDeepLinkKey,
    isAuthReady,
    isLoading,
    loadPaymentTimeline,
    timelineQuery,
    timelineQueryKey,
  ]);

  const { totalAmount, totalBeads } = useMemo(
    () => getCompletedPaymentTotals(payments),
    [payments],
  );

  const pageState: PaymentHistoryPageState = {
    isLoading,
    isAuthReady,
  };

  const pageHandlers: PaymentHistoryPageHandlers = {
    onBack,
  };

  const errorState: PaymentHistoryErrorState | null = errorMessage
    ? {
        message: errorMessage,
        actionLabel: errorActionLabel,
      }
    : null;

  const errorHandlers: PaymentHistoryErrorHandlers = {
    onAction: onErrorAction,
  };

  const filterState: PaymentHistoryFilterState = {
    filter,
  };

  const filterHandlers: PaymentHistoryFilterHandlers = {
    onFilterChange: setFilter,
  };

  const statsState: PaymentHistoryStatsState = {
    totalAmount,
    totalBeads,
    totalCount: payments.length,
  };

  const listState: PaymentHistoryListState = {
    payments: filteredPayments,
    filter,
    selectedOrderId,
    timelineLoadingOrderId: timelineLoadingOrderId?.startsWith("order:")
      ? timelineLoadingOrderId.slice("order:".length)
      : null,
  };

  const listHandlers: PaymentHistoryListHandlers = {
    onGoBead,
    onOpenTimeline: (orderId, paymentFlowId) => {
      loadPaymentTimeline(orderId, paymentFlowId).catch(() => undefined);
    },
  };

  const selectedPayment = useMemo(() => {
    if (!selectedOrderId) return null;
    return (
      payments.find(payment => payment.order_id === selectedOrderId) || null
    );
  }, [payments, selectedOrderId]);

  const selectedTimeline = useMemo(() => {
    if (!selectedTimelineKey) return null;
    const byKey = timelineByRequestKey[selectedTimelineKey];
    if (byKey) return byKey;
    if (selectedOrderId) {
      const byOrder = timelineByRequestKey[`order:${selectedOrderId}`];
      if (byOrder) return byOrder;
    }
    if (selectedTimelineFlowId) {
      const byFlow = timelineByRequestKey[`flow:${selectedTimelineFlowId}`];
      if (byFlow) return byFlow;
    }
    return null;
  }, [
    selectedOrderId,
    selectedTimelineFlowId,
    selectedTimelineKey,
    timelineByRequestKey,
  ]);

  const selectedTimelineError = useMemo(() => {
    if (!selectedTimelineKey) return null;
    const byKey = timelineErrorByRequestKey[selectedTimelineKey];
    if (byKey) return byKey;
    if (selectedOrderId) {
      const byOrder = timelineErrorByRequestKey[`order:${selectedOrderId}`];
      if (byOrder) return byOrder;
    }
    if (selectedTimelineFlowId) {
      const byFlow =
        timelineErrorByRequestKey[`flow:${selectedTimelineFlowId}`];
      if (byFlow) return byFlow;
    }
    return null;
  }, [
    selectedOrderId,
    selectedTimelineFlowId,
    selectedTimelineKey,
    timelineErrorByRequestKey,
  ]);

  const timelinePanelState: PaymentTimelinePanelState = {
    isOpen: Boolean(selectedTimelineKey),
    isLoading:
      Boolean(selectedTimelineKey) &&
      timelineLoadingOrderId === selectedTimelineKey,
    orderId: selectedOrderId || selectedTimeline?.orderId || null,
    paymentFlowId:
      selectedTimeline?.paymentFlowId ||
      selectedTimelineFlowId ||
      selectedPayment?.payment_flow_id ||
      null,
    status: selectedTimeline?.status || selectedPayment?.status || null,
    events: selectedTimeline?.events || [],
    errorMessage: selectedTimelineError || null,
  };

  const timelinePanelHandlers: PaymentTimelinePanelHandlers = {
    onClose: () => {
      setSelectedTimelineKey(null);
      setSelectedTimelineFlowId(null);
      setSelectedOrderId(null);
    },
    onRetry: () => {
      if (!selectedTimelineKey) return;
      const parsed = parseTimelineRequestKey(selectedTimelineKey);
      const orderId =
        selectedOrderId || parsed.orderId || selectedTimeline?.orderId || null;
      const flowId =
        selectedTimelineFlowId ||
        parsed.paymentFlowId ||
        selectedTimeline?.paymentFlowId ||
        selectedPayment?.payment_flow_id ||
        null;
      loadPaymentTimeline(orderId, flowId, {
        forceRefresh: true,
      }).catch(() => undefined);
    },
  };

  const formatters: PaymentHistoryFormatters = {
    formatDate,
    formatCurrency,
  };

  return {
    pageState,
    pageHandlers,
    errorState,
    errorHandlers,
    filterState,
    filterHandlers,
    statsState,
    listState,
    listHandlers,
    timelinePanelState,
    timelinePanelHandlers,
    formatters,
  };
}
