"use client";

import { Suspense, useEffect, useState } from "react";

import { useSearchParams } from "next/navigation";

import PaymentSuccessErrorCard from "@/app/components/payment-success/PaymentSuccessErrorCard";
import PaymentSuccessLoadingCard from "@/app/components/payment-success/PaymentSuccessLoadingCard";
import PaymentSuccessResultCard from "@/app/components/payment-success/PaymentSuccessResultCard";
import PaymentSuccessShell from "@/app/components/payment-success/PaymentSuccessShell";
import beadApi from "@/lib/client/api/bead";
import {
  parsePaymentSuccessParams,
  toPaymentProcessingErrorMessage,
} from "@/lib/ui/payment-success";
import useBead from "@/services/hooks/use-bead";

interface PaymentInfo {
  orderId: string;
  amount: number;
  paymentKey: string;
  paymentFlowId?: string;
}

function PaymentSuccessPageContent() {
  const searchParams = useSearchParams();
  const { setBead } = useBead();

  const [isProcessing, setIsProcessing] = useState(true);
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const processPayment = async () => {
      const parsed = parsePaymentSuccessParams(searchParams);
      if (!parsed.ok) {
        setError(parsed.errorMessage);
        setIsProcessing(false);
        return;
      }

      try {
        const { paymentKey, orderId, amount } = parsed.value;
        const paymentFlowId =
          (searchParams.get("flowId") || "").trim() || undefined;
        const updatedBead = await beadApi.completeBeadPurchase(
          paymentKey,
          orderId,
          amount,
          paymentFlowId,
        );

        setBead(updatedBead);
        setPaymentInfo({
          orderId,
          amount,
          paymentKey,
          paymentFlowId,
        });
      } catch (caughtError) {
        setError(toPaymentProcessingErrorMessage(caughtError));
      } finally {
        setIsProcessing(false);
      }
    };

    processPayment();
  }, [searchParams, setBead]);

  if (isProcessing) {
    return (
      <PaymentSuccessShell tone="success">
        <PaymentSuccessLoadingCard title="결제 처리 중" />
      </PaymentSuccessShell>
    );
  }

  if (error) {
    return (
      <PaymentSuccessShell tone="error">
        <PaymentSuccessErrorCard message={error} />
      </PaymentSuccessShell>
    );
  }

  return (
    <PaymentSuccessShell tone="success">
      <PaymentSuccessResultCard paymentInfo={paymentInfo} />
    </PaymentSuccessShell>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <PaymentSuccessShell tone="success">
          <PaymentSuccessLoadingCard title="결제 처리 준비 중" />
        </PaymentSuccessShell>
      }
    >
      <PaymentSuccessPageContent />
    </Suspense>
  );
}
