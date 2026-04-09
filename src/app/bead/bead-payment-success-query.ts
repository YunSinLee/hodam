export interface BeadPaymentSuccessQuery {
  paymentKey: string;
  orderId: string;
  amount: number;
  paymentFlowId?: string;
}

export interface ParseBeadPaymentSuccessQueryResult {
  query: BeadPaymentSuccessQuery | null;
  errorMessage: string | null;
}

type SearchParamsLike = {
  get: (key: string) => string | null;
};

export function parseBeadPaymentSuccessQuery(
  searchParams: SearchParamsLike,
): ParseBeadPaymentSuccessQueryResult {
  const paymentKey = searchParams.get("paymentKey");
  const orderId = searchParams.get("orderId");
  const amountRaw = searchParams.get("amount");
  const paymentFlowId = (searchParams.get("flowId") || "").trim() || undefined;

  if (!paymentKey || !orderId || !amountRaw) {
    return {
      query: null,
      errorMessage: null,
    };
  }

  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      query: null,
      errorMessage: "결제 파라미터가 올바르지 않습니다.",
    };
  }

  return {
    query: {
      paymentKey,
      orderId,
      amount,
      paymentFlowId,
    },
    errorMessage: null,
  };
}
