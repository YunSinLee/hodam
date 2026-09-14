import paymentClient from "@/lib/client/api/payment";

export * from "@/lib/client/api/payment";

const paymentApi = {
  ...paymentClient,
  async getPaymentHistory(userId?: string) {
    const payments = await paymentClient.getPaymentHistory();
    if (userId && payments.some(payment => payment.user_id !== userId)) {
      throw new Error("로그인 정보를 확인해주세요.");
    }
    return payments;
  },
};

export default paymentApi;
