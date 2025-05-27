import type { Bead } from "@/services/hooks/use-bead";

import { supabase } from "../utils/supabase";
// eslint-disable-next-line import/order
import paymentApi, { PaymentRequest } from "./payment";

const beadApi = {
  async initializeBead(user_id: string) {
    const hasBead = await hasBeadAlready();

    if (!hasBead) {
      const { data, error } = await supabase
        .from("bead")
        .insert({ user_id })
        .select();

      if (error) {
        console.error("Error initializing bead", error);
      }

      return data![0] as Bead;
    }
    const { data, error } = await supabase
      .from("bead")
      .select()
      .eq("user_id", user_id);

    if (error) {
      console.error("Error getting bead", error);
    }

    return data![0] as Bead;

    async function hasBeadAlready() {
      const { data, error } = await supabase
        .from("bead")
        .select()
        .eq("user_id", user_id);

      if (error) {
        console.error("Error getting bead", error);
      }

      if (data && data.length > 0) {
        return true;
      }
      return false;
    }
  },

  async updateBeadCount(user_id: string, count: number) {
    const { data, error } = await supabase
      .from("bead")
      .update({ count })
      .eq("user_id", user_id)
      .select();

    if (error) {
      console.error("Error updating bead count", error);
    }
    return data![0] as Bead;
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
      await paymentApi.processBeadReward(orderId, userId);

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
    return [
      {
        id: "bead_5",
        quantity: 5,
        price: 2500,
        originalPrice: 3000,
        discount: 17,
        popular: false,
        description: "기본 패키지",
      },
      {
        id: "bead_10",
        quantity: 10,
        price: 5000,
        originalPrice: 6000,
        discount: 17,
        popular: true,
        description: "인기 패키지",
      },
      {
        id: "bead_20",
        quantity: 20,
        price: 10000,
        originalPrice: 12000,
        discount: 17,
        popular: false,
        description: "알뜰 패키지",
      },
      {
        id: "bead_100",
        quantity: 100,
        price: 50000,
        originalPrice: 60000,
        discount: 17,
        popular: false,
        description: "대용량 패키지",
      },
    ];
  },
};

export default beadApi;
