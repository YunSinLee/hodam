"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import type {
  BeadPageFeedbackState,
  BeadPageHandlers,
  BeadPageState,
  BeadPageStatusState,
} from "@/app/bead/bead-page-contract";
import { parseBeadPaymentSuccessQuery } from "@/app/bead/bead-payment-success-query";
import { resolveBeadSessionUser } from "@/app/bead/bead-session-user";
import { recoverSessionUserInfo } from "@/lib/auth/session-recovery";
import { buildSignInRedirectPath } from "@/lib/auth/sign-in-redirect";
import beadApi from "@/lib/client/api/bead";
import type { BeadPackage } from "@/lib/payments/packages";
import { resolveTossClientKey } from "@/lib/payments/toss-client";
import {
  type BeadPaymentFeedbackAction,
  isAlreadyProcessedPaymentError,
  resolveBeadPaymentFeedback,
} from "@/lib/ui/bead-payment-error";
import useBead from "@/services/hooks/use-bead";
import useUserInfo from "@/services/hooks/use-user-info";

interface TossPaymentsInstance {
  requestPayment: (
    method: string,
    options: {
      amount: number;
      orderId: string;
      orderName: string;
      customerName: string;
      customerEmail: string;
      successUrl: string;
      failUrl: string;
    },
  ) => Promise<void>;
}

type TossPaymentsFactory = (clientKey: string) => TossPaymentsInstance;

declare global {
  interface Window {
    TossPayments?: TossPaymentsFactory;
  }
}

interface BeadPageFeedbackInternal {
  type: "error" | "success";
  message: string;
  action?: BeadPaymentFeedbackAction | null;
}

export default function useBeadPageController() {
  const { bead, setBead } = useBead();
  const { userInfo, setUserInfo, hasHydrated } = useUserInfo();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isLoading, setIsLoading] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<BeadPackage | null>(
    null,
  );
  const [processedPayments, setProcessedPayments] = useState<Set<string>>(
    new Set(),
  );
  const [pageFeedback, setPageFeedback] =
    useState<BeadPageFeedbackInternal | null>(null);

  const tossClientKey = useMemo(() => resolveTossClientKey(), []);
  const packages = useMemo(() => beadApi.getBeadPackages(), []);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://js.tosspayments.com/v1/payment";
    script.async = true;
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  const resolveActiveSessionUser = useCallback(
    async (options: { requireEmail?: boolean } = {}) => {
      return resolveBeadSessionUser(
        {
          currentUser: userInfo,
          recoverSessionUser: () => recoverSessionUserInfo(),
          onRecoveredUser: recoveredUserInfo => {
            setUserInfo(recoveredUserInfo);
          },
        },
        options,
      );
    },
    [setUserInfo, userInfo],
  );

  const handlePaymentSuccess = useCallback(
    async (
      paymentKey: string,
      orderId: string,
      amount: number,
      paymentFlowId?: string,
    ) => {
      if (isLoading) return;
      setPageFeedback(null);

      const activeSessionUser = await resolveActiveSessionUser();
      if (!activeSessionUser?.id) {
        setPageFeedback({
          type: "error",
          message: "로그인 정보를 찾을 수 없습니다. 다시 로그인해주세요.",
          action: {
            type: "goSignIn",
            label: "다시 로그인",
          },
        });
        return;
      }

      setIsLoading(true);
      try {
        const updatedBead = await beadApi.completeBeadPurchase(
          paymentKey,
          orderId,
          amount,
          paymentFlowId,
        );
        setBead(updatedBead);
        setPageFeedback({
          type: "success",
          message: "곶감 충전이 완료되었습니다.",
          action: null,
        });
        router.replace("/bead");
      } catch (error) {
        if (isAlreadyProcessedPaymentError(error)) {
          setPageFeedback({
            type: "success",
            message: "이미 처리된 결제입니다.",
            action: null,
          });
          router.replace("/bead");
          return;
        }

        const feedback = resolveBeadPaymentFeedback(error);
        setPageFeedback({
          type: "error",
          message: feedback.message,
          action: feedback.action,
        });
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, resolveActiveSessionUser, router, setBead],
  );

  useEffect(() => {
    const parsedQuery = parseBeadPaymentSuccessQuery(searchParams);
    if (parsedQuery.errorMessage) {
      setPageFeedback({
        type: "error",
        message: parsedQuery.errorMessage,
      });
      return;
    }
    if (!parsedQuery.query) return;

    const { paymentKey, orderId, amount, paymentFlowId } = parsedQuery.query;

    const paymentId = `${paymentKey}_${orderId}`;
    if (processedPayments.has(paymentId)) return;

    setProcessedPayments(prev => new Set(prev).add(paymentId));
    handlePaymentSuccess(paymentKey, orderId, amount, paymentFlowId);
  }, [handlePaymentSuccess, processedPayments, searchParams]);

  const onPurchase = useCallback(
    async (packageInfo: BeadPackage) => {
      const activeSessionUser = await resolveActiveSessionUser({
        requireEmail: true,
      });
      if (!activeSessionUser?.id || !activeSessionUser.email) {
        setPageFeedback({
          type: "error",
          message: "로그인이 필요합니다.",
          action: {
            type: "goSignIn",
            label: "로그인하기",
          },
        });
        return;
      }

      setPageFeedback(null);
      setIsLoading(true);
      setSelectedPackage(packageInfo);

      try {
        const { orderId, amount, paymentFlowId } = await beadApi.purchaseBeads(
          packageInfo.quantity,
          packageInfo.price,
        );

        if (!tossClientKey) {
          throw new Error("MISSING_TOSS_CLIENT_KEY");
        }

        if (!window.TossPayments) {
          throw new Error("결제 모듈이 아직 로드되지 않았습니다.");
        }
        const tossPayments = window.TossPayments(tossClientKey);
        const successUrl = new URL(
          `${window.location.protocol}//${window.location.host}/bead`,
        );
        if (paymentFlowId) {
          successUrl.searchParams.set("flowId", paymentFlowId);
        }

        await tossPayments.requestPayment("카드", {
          amount,
          orderId,
          orderName: `곶감 ${packageInfo.quantity}개`,
          customerName: activeSessionUser.email.split("@")[0],
          customerEmail: activeSessionUser.email,
          successUrl: successUrl.toString(),
          failUrl: `${window.location.protocol}//${window.location.host}/bead?failed=true`,
        });
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes("MISSING_TOSS_CLIENT_KEY")
        ) {
          setPageFeedback({
            type: "error",
            message: "결제 설정이 올바르지 않습니다. 관리자에게 문의해주세요.",
            action: {
              type: "retry",
              label: "다시 시도",
            },
          });
          return;
        }

        setPageFeedback({
          type: "error",
          message: "결제 요청 중 오류가 발생했습니다.",
          action: {
            type: "retry",
            label: "다시 시도",
          },
        });
      } finally {
        setIsLoading(false);
        setSelectedPackage(null);
      }
    },
    [resolveActiveSessionUser, tossClientKey],
  );

  const onOpenPaymentHistory = useCallback(() => {
    router.push("/payment-history");
  }, [router]);

  const onRetryPageAction = useCallback(() => {
    router.replace("/bead");
  }, [router]);

  const onFeedbackAction = useCallback(() => {
    if (!pageFeedback?.action) return;

    if (pageFeedback.action.type === "goSignIn") {
      router.push(buildSignInRedirectPath("/bead"));
      return;
    }

    onRetryPageAction();
  }, [onRetryPageAction, pageFeedback?.action, router]);

  const statusState: BeadPageStatusState = {
    hasHydrated,
    userId: userInfo.id,
  };

  const feedbackState: BeadPageFeedbackState | null = pageFeedback
    ? {
        type: pageFeedback.type,
        message: pageFeedback.message,
        actionLabel: pageFeedback.action?.label,
      }
    : null;

  const pageState: BeadPageState = {
    tossClientKey,
    beadCount: bead?.count || 0,
    packages,
    isLoading,
    selectedPackageId: selectedPackage?.id || null,
    pageFeedback: feedbackState,
  };

  const handlers: BeadPageHandlers = {
    onPurchase,
    onOpenPaymentHistory,
    onFeedbackAction,
  };

  return {
    statusState,
    pageState,
    handlers,
  };
}
