import { BeadResponseSchema } from "@/app/api/v1/schemas";
import type { BeadResponse } from "@/app/api/v1/types";
import { authorizedFetch } from "@/lib/client/api/http";
import {
  BEAD_PACKAGES,
  type BeadPackage as SharedBeadPackage,
} from "@/lib/payments/packages";
import type { Bead } from "@/services/hooks/use-bead";

import paymentApi from "./payment";

function toBead(data: BeadResponse["bead"]): Bead {
  return {
    id: data.id,
    count: Number(data.count || 0),
    created: undefined,
    user_id: data.user_id,
  };
}

const beadApi = {
  async initializeBead() {
    const response = await authorizedFetch<BeadResponse>(
      "/api/v1/beads",
      {
        method: "GET",
      },
      BeadResponseSchema,
    );

    return toBead(response.bead);
  },

  // 결제를 통한 곶감 충전 준비
  async purchaseBeads(
    quantity: number,
    amount: number,
  ): Promise<{ orderId: string; amount: number }> {
    const packageInfo = BEAD_PACKAGES.find(
      item => item.quantity === quantity && item.price === amount,
    );

    if (!packageInfo) {
      throw new Error("지원하지 않는 결제 패키지입니다.");
    }

    const prepared = await paymentApi.preparePayment(packageInfo.id);

    return {
      orderId: prepared.orderId,
      amount: prepared.amount,
    };
  },

  // 결제 완료 후 곶감 지급
  async completeBeadPurchase(
    paymentKey: string,
    orderId: string,
    amount: number,
  ): Promise<Bead> {
    const paymentResult = await paymentApi.confirmPayment(
      paymentKey,
      orderId,
      amount,
    );

    if (!paymentResult.success) {
      const status = await paymentApi
        .getPaymentStatus(orderId, {
          paymentKey,
          amount,
        })
        .catch(() => null);

      if (status?.status === "completed") {
        const current = await this.initializeBead();
        return {
          ...current,
          count:
            typeof status.beadCount === "number"
              ? status.beadCount
              : current.count,
        };
      }

      if (status?.status === "pending") {
        throw new Error(
          "결제가 아직 처리 중입니다. 잠시 후 다시 확인해주세요.",
        );
      }

      throw new Error(paymentResult.error || "결제 승인에 실패했습니다.");
    }

    if (typeof paymentResult.beadCount === "number") {
      const current = await this.initializeBead();
      return {
        ...current,
        count: paymentResult.beadCount,
      };
    }

    return this.initializeBead();
  },

  // 결제 내역 조회
  async getPaymentHistory() {
    return paymentApi.getPaymentHistory();
  },

  // 곶감 패키지 정보
  getBeadPackages() {
    return [...BEAD_PACKAGES] as SharedBeadPackage[];
  },
};

export default beadApi;
