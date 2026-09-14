export const beadPackages = [
  { id: "bead_5", quantity: 5, price: 2500 },
  { id: "bead_10", quantity: 10, price: 5000 },
  { id: "bead_20", quantity: 20, price: 10000 },
  { id: "bead_100", quantity: 100, price: 50000 },
];
export function validPackage(quantity: unknown, amount: unknown) {
  return beadPackages.some(
    item => item.quantity === quantity && item.price === amount,
  );
}
export function validPaymentInput(
  value: unknown,
): value is { paymentKey: string; orderId: string; amount: number } {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  return (
    typeof input.paymentKey === "string" &&
    /^[A-Za-z0-9_-]{1,200}$/.test(input.paymentKey) &&
    typeof input.orderId === "string" &&
    /^[A-Za-z0-9_-]{1,64}$/.test(input.orderId) &&
    Number.isSafeInteger(input.amount) &&
    Number(input.amount) > 0
  );
}
