import { requireAccessToken } from "../utils/session";
import { supabase } from "../utils/supabase";

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
  async createPaymentRequest(
    request: PaymentRequest,
  ): Promise<{ orderId: string; amount: number }> {
    const token = await requireAccessToken();
    const response = await fetch("/api/routes/payment/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ quantity: request.beadQuantity }),
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error || "주문을 만들지 못했어요.");
    return result;
  },
  async confirmPayment(
    paymentKey: string,
    orderId: string,
    amount: number,
  ): Promise<PaymentResult> {
    const token = await requireAccessToken();
    const response = await fetch("/api/routes/payment/confirm", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error || "결제 상태를 확인하지 못했어요.");
    return { success: true, paymentKey, orderId, amount };
  },
  async getPaymentHistory(userId: string): Promise<PaymentHistory[]> {
    const { data, error } = await supabase
      .from("payment_history")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },
  generateOrderId() {
    return `HODAM_${crypto.randomUUID()}`;
  },
};
export default paymentApi;
