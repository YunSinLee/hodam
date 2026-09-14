import PaymentSuccessCard from "@/app/components/payment-success/PaymentSuccessCard";

interface PaymentSuccessLoadingCardProps {
  title: string;
  description?: string;
}

export default function PaymentSuccessLoadingCard({
  title,
  description = "잠시만 기다려주세요...",
}: PaymentSuccessLoadingCardProps) {
  return (
    <PaymentSuccessCard>
      <div className="mx-auto mb-6 h-16 w-16 animate-spin rounded-full border-4 border-green-200 border-t-green-500" />
      <h2 className="mb-2 text-2xl font-bold text-gray-800">{title}</h2>
      <p className="text-gray-600">{description}</p>
    </PaymentSuccessCard>
  );
}
