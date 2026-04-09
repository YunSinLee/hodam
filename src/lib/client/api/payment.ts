import {
  ConfirmPaymentResponseSchema,
  PaymentHistoryResponseSchema,
  PaymentStatusResponseSchema,
  PaymentTimelineResponseSchema,
  PreparePaymentResponseSchema,
} from "@/app/api/v1/schemas";
import type {
  ConfirmPaymentResponse,
  PaymentHistoryItem,
  PaymentHistoryResponse,
  PaymentStatusResponse,
  PaymentTimelineResponse,
  PreparePaymentResponse,
} from "@/app/api/v1/types";
import { ApiError, authorizedFetch } from "@/lib/client/api/http";
import { PAYMENT_FLOW_HEADER } from "@/lib/payments/flow-diagnostics";
import { BEAD_PACKAGES } from "@/lib/payments/packages";

// 결제 관련 타입 정의
export interface PaymentRequest {
  amount: number;
  orderId: string;
  orderName: string;
  customerEmail: string;
  customerName: string;
  beadQuantity: number;
  userId: string;
}

export interface PaymentResult {
  success: boolean;
  paymentKey?: string;
  orderId?: string;
  amount?: number;
  paymentFlowId?: string;
  error?: string;
  errorCode?: string;
  errorStatus?: number;
  beadCount?: number;
  alreadyProcessed?: boolean;
}

export type PaymentHistory = PaymentHistoryItem;
export type PaymentStatus = PaymentStatusResponse;
export type PaymentTimeline = PaymentTimelineResponse;

interface PaymentTimelineLookupParams {
  orderId?: string;
  paymentFlowId?: string;
}

function createPaymentFlowHeaders(
  paymentFlowId?: string,
): HeadersInit | undefined {
  if (typeof paymentFlowId !== "string") {
    return undefined;
  }

  const normalized = paymentFlowId.trim();
  if (!normalized) {
    return undefined;
  }

  return {
    [PAYMENT_FLOW_HEADER]: normalized,
  };
}

const paymentApi = {
  // 신규 결제 준비 API
  async preparePayment(packageId: string): Promise<PreparePaymentResponse> {
    return authorizedFetch<PreparePaymentResponse>(
      "/api/v1/payments/prepare",
      {
        method: "POST",
        body: JSON.stringify({ packageId }),
      },
      PreparePaymentResponseSchema,
    );
  },

  // 레거시 인터페이스 호환
  async createPaymentRequest(
    request: PaymentRequest,
  ): Promise<{ orderId: string; amount: number }> {
    const packageId = this.resolvePackageId(
      request.beadQuantity,
      request.amount,
    );
    const prepared = await this.preparePayment(packageId);

    return {
      orderId: prepared.orderId,
      amount: prepared.amount,
    };
  },

  // 토스페이먼츠 결제 승인 + 지급 처리
  async confirmPayment(
    paymentKey: string,
    orderId: string,
    amount: number,
    options: { paymentFlowId?: string } = {},
  ): Promise<PaymentResult> {
    try {
      const result = await authorizedFetch<ConfirmPaymentResponse>(
        "/api/v1/payments/confirm",
        {
          method: "POST",
          headers: createPaymentFlowHeaders(options.paymentFlowId),
          body: JSON.stringify({
            paymentKey,
            orderId,
            amount,
          }),
        },
        ConfirmPaymentResponseSchema,
      );

      return {
        success: true,
        paymentKey: result.paymentKey,
        orderId: result.orderId,
        amount: result.amount,
        paymentFlowId: result.paymentFlowId || options.paymentFlowId,
        beadCount: result.beadCount,
        alreadyProcessed: result.alreadyProcessed,
      };
    } catch (error) {
      return {
        success: false,
        paymentFlowId: options.paymentFlowId,
        error:
          error instanceof Error ? error.message : "결제 승인에 실패했습니다.",
        errorCode: error instanceof ApiError ? error.code : undefined,
        errorStatus: error instanceof ApiError ? error.status : undefined,
      };
    }
  },

  // 결제 내역 조회
  async getPaymentHistory(): Promise<PaymentHistory[]> {
    const data = await authorizedFetch<PaymentHistoryResponse>(
      "/api/v1/payments/history",
      {
        method: "GET",
      },
      PaymentHistoryResponseSchema,
    );

    return data.payments || [];
  },

  // 결제 상태 조회/복구
  async getPaymentStatus(
    orderId: string,
    options: {
      paymentKey?: string;
      amount?: number;
      paymentFlowId?: string;
    } = {},
  ): Promise<PaymentStatus> {
    const searchParams = new URLSearchParams();
    searchParams.set("orderId", orderId);
    if (typeof options.paymentKey === "string" && options.paymentKey.trim()) {
      searchParams.set("paymentKey", options.paymentKey.trim());
    }
    if (Number.isFinite(options.amount) && Number(options.amount) > 0) {
      searchParams.set("amount", String(options.amount));
    }

    return authorizedFetch<PaymentStatus>(
      `/api/v1/payments/status?${searchParams.toString()}`,
      {
        method: "GET",
        headers: createPaymentFlowHeaders(options.paymentFlowId),
      },
      PaymentStatusResponseSchema,
    );
  },

  async getPaymentTimeline(
    params: PaymentTimelineLookupParams,
    options: { paymentFlowId?: string } = {},
  ): Promise<PaymentTimeline> {
    const normalizedOrderId = (params.orderId || "").trim();
    const normalizedPaymentFlowId = (params.paymentFlowId || "").trim();
    if (!normalizedOrderId && !normalizedPaymentFlowId) {
      throw new Error("orderId 또는 paymentFlowId가 필요합니다.");
    }

    const searchParams = new URLSearchParams();
    if (normalizedOrderId) {
      searchParams.set("orderId", normalizedOrderId);
    }
    if (normalizedPaymentFlowId) {
      searchParams.set("paymentFlowId", normalizedPaymentFlowId);
    }

    return authorizedFetch<PaymentTimeline>(
      `/api/v1/payments/timeline?${searchParams.toString()}`,
      {
        method: "GET",
        headers: createPaymentFlowHeaders(
          options.paymentFlowId || normalizedPaymentFlowId,
        ),
      },
      PaymentTimelineResponseSchema,
    );
  },

  // 레거시 호환용
  generateOrderId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `HODAM_${timestamp}_${random}`;
  },

  resolvePackageId(beadQuantity: number, amount: number): string {
    const matched = BEAD_PACKAGES.find(
      item => item.quantity === beadQuantity && item.price === amount,
    );
    if (!matched) {
      throw new Error("지원하지 않는 결제 패키지입니다.");
    }

    return matched.id;
  },
};

export default paymentApi;
