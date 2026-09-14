import type { Bead } from "@/services/hooks/use-bead";

import { beadPackages } from "../utils/bead-packages";
import { supabase } from "../utils/supabase";
// eslint-disable-next-line import/order
import paymentApi, { PaymentRequest } from "./payment";

function requireBead(data: Bead[] | null, context: string) {
  if (!data || data.length === 0) {
    throw new Error(`${context}: 곶감 정보를 불러오지 못했습니다.`);
  }

  return data[0] as Bead;
}

const beadApi = {
  async initializeBead(user_id: string) {
    // StrictMode or two open tabs can initialize simultaneously. An insert-only
    // upsert preserves an existing balance and avoids a duplicate signup grant.
    const { error: insertError } = await supabase
      .from("bead")
      .upsert({ user_id }, { onConflict: "user_id", ignoreDuplicates: true });
    if (insertError) throw insertError;
    const { data, error } = await supabase
      .from("bead")
      .select()
      .eq("user_id", user_id);
    if (error) throw error;
    return requireBead(data as Bead[] | null, "initializeBead");
  },

  // 결제를 통한 곶감 충전
  async purchaseBeads(
    userId: string,
    userEmail: string,
    userName: string,
    quantity: number,
    amount: number,
  ): Promise<{ orderId: string; amount: number }> {
    try {
      const orderId = paymentApi.generateOrderId();

      const paymentRequest: PaymentRequest = {
        amount,
        orderId,
        orderName: `곶감 ${quantity}개`,
        customerEmail: userEmail,
        customerName: userName,
        beadQuantity: quantity,
        userId,
      };

      // 결제 요청 생성 (데이터베이스에 pending 상태로 저장)
      const result = await paymentApi.createPaymentRequest(paymentRequest);

      return result;
    } catch (error) {
      console.error("곶감 구매 요청 오류:", error);
      throw error;
    }
  },

  // 결제 완료 후 곶감 지급
  async completeBeadPurchase(
    paymentKey: string,
    orderId: string,
    amount: number,
    userId: string,
  ): Promise<Bead> {
    try {
      // 토스페이먼츠 결제 승인
      const paymentResult = await paymentApi.confirmPayment(
        paymentKey,
        orderId,
        amount,
      );

      if (!paymentResult.success) {
        throw new Error(paymentResult.error || "결제 승인에 실패했습니다.");
      }

      // 곶감 지급 처리
      // Confirmation and reward are now one server-side operation.

      // 업데이트된 곶감 정보 반환
      const { data, error } = await supabase
        .from("bead")
        .select()
        .eq("user_id", userId)
        .single();

      if (error) {
        console.error("Error getting updated bead count", error);
        throw error;
      }

      return data as Bead;
    } catch (error) {
      console.error("곶감 구매 완료 처리 오류:", error);
      throw error;
    }
  },

  // 결제 내역 조회
  async getPaymentHistory(userId: string) {
    return paymentApi.getPaymentHistory(userId);
  },

  // 곶감 패키지 정보
  getBeadPackages() {
    return beadPackages;
  },
};
export default beadApi;
