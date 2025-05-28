import { supabase } from "../utils/supabase";

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
  error?: string;
}

export interface PaymentHistory {
  id: string;
  user_id: string;
  order_id: string;
  payment_key?: string;
  amount: number;
  bead_quantity: number;
  status: "pending" | "completed" | "failed" | "cancelled";
  created_at: string;
  completed_at?: string;
}

const paymentApi = {
  // 결제 요청 생성
  async createPaymentRequest(
    request: PaymentRequest,
  ): Promise<{ orderId: string; amount: number }> {
    try {
      // 주문 정보를 데이터베이스에 저장
      const { data, error } = await supabase
        .from("payment_history")
        .insert({
          order_id: request.orderId,
          user_id: request.userId,
          amount: request.amount,
          bead_quantity: request.beadQuantity,
          status: "pending",
        })
        .select()
        .single();

      if (error) {
        console.error("결제 요청 생성 오류:", error);
        throw new Error("결제 요청 생성에 실패했습니다.");
      }

      return {
        orderId: request.orderId,
        amount: request.amount,
      };
    } catch (error) {
      console.error("결제 요청 생성 오류:", error);
      throw error;
    }
  },

  // 토스페이먼츠 결제 승인
  async confirmPayment(
    paymentKey: string,
    orderId: string,
    amount: number,
  ): Promise<PaymentResult> {
    try {
      const response = await fetch("/api/routes/payment/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          paymentKey,
          orderId,
          amount,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "결제 승인에 실패했습니다.");
      }

      // 결제 성공 시 데이터베이스 업데이트
      await this.updatePaymentStatus(orderId, "completed", paymentKey);

      return {
        success: true,
        paymentKey,
        orderId,
        amount,
      };
    } catch (error) {
      console.error("결제 승인 오류:", error);

      // 결제 실패 시 상태 업데이트
      await this.updatePaymentStatus(orderId, "failed");

      return {
        success: false,
        error:
          error instanceof Error ? error.message : "결제 승인에 실패했습니다.",
      };
    }
  },

  // 결제 상태 업데이트
  async updatePaymentStatus(
    orderId: string,
    status: "pending" | "completed" | "failed" | "cancelled",
    paymentKey?: string,
  ): Promise<void> {
    try {
      const updateData: any = {
        status,
        ...(status === "completed" && {
          completed_at: new Date().toISOString(),
        }),
        ...(paymentKey && { payment_key: paymentKey }),
      };

      const { error } = await supabase
        .from("payment_history")
        .update(updateData)
        .eq("order_id", orderId);

      if (error) {
        console.error("결제 상태 업데이트 오류:", error);
        throw error;
      }
    } catch (error) {
      console.error("결제 상태 업데이트 오류:", error);
      throw error;
    }
  },

  // 곶감 지급 처리
  async processBeadReward(orderId: string, userId: string): Promise<void> {
    try {
      // 결제 정보 조회
      const { data: paymentData, error: paymentError } = await supabase
        .from("payment_history")
        .select("*")
        .eq("order_id", orderId)
        .eq("status", "completed")
        .single();

      if (paymentError || !paymentData) {
        throw new Error("완료된 결제 정보를 찾을 수 없습니다.");
      }

      // 현재 곶감 수량 조회
      const { data: beadData, error: beadError } = await supabase
        .from("bead")
        .select("count")
        .eq("user_id", userId)
        .single();

      if (beadError) {
        throw new Error("사용자 곶감 정보를 찾을 수 없습니다.");
      }

      // 곶감 수량 업데이트
      const newBeadCount = (beadData.count || 0) + paymentData.bead_quantity;

      const { error: updateError } = await supabase
        .from("bead")
        .update({ count: newBeadCount })
        .eq("user_id", userId);

      if (updateError) {
        throw new Error("곶감 지급에 실패했습니다.");
      }

      console.log(
        `사용자 ${userId}에게 ${paymentData.bead_quantity}개 곶감 지급 완료`,
      );
    } catch (error) {
      console.error("곶감 지급 처리 오류:", error);
      throw error;
    }
  },

  // 결제 내역 조회
  async getPaymentHistory(userId: string): Promise<PaymentHistory[]> {
    try {
      const { data, error } = await supabase
        .from("payment_history")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("결제 내역 조회 오류:", error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error("결제 내역 조회 오류:", error);
      throw error;
    }
  },

  // 주문 ID 생성
  generateOrderId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `HODAM_${timestamp}_${random}`;
  },
};

export default paymentApi;
