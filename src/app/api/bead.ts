import beadClient from "@/lib/client/api/bead";

import paymentApi from "./payment";

// Compatibility for the picturebook pages. Identity comes from the authenticated
// v1 request, while legacy account arguments stay out of payment payloads.
const beadApi = {
  ...beadClient,
  async initializeBead(userId?: string) {
    const bead = await beadClient.initializeBead();
    if (userId && bead.user_id !== userId) {
      throw new Error("로그인 정보를 확인해주세요.");
    }
    return bead;
  },
  async purchaseBeads(
    _userId: string,
    _userEmail: string,
    _userName: string,
    quantity: number,
    amount: number,
  ) {
    return beadClient.purchaseBeads(quantity, amount);
  },
  async completeBeadPurchase(
    paymentKey: string,
    orderId: string,
    amount: number,
    userId: string,
  ) {
    const bead = await beadClient.completeBeadPurchase(
      paymentKey,
      orderId,
      amount,
    );
    if (bead.user_id !== userId) {
      throw new Error("로그인 정보를 확인해주세요.");
    }
    return bead;
  },
  async getPaymentHistory(userId?: string) {
    return paymentApi.getPaymentHistory(userId);
  },
};

export default beadApi;
