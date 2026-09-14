import Image from "next/image";

interface BeadBalanceCardProps {
  count: number;
}

export default function BeadBalanceCard({ count }: BeadBalanceCardProps) {
  return (
    <section className="mb-8 rounded-2xl bg-gradient-to-r from-orange-50 to-amber-50 p-5 text-center sm:p-6">
      <div className="mb-2 flex items-center justify-center gap-3">
        <Image
          src="/persimmon_240424.png"
          alt="곶감"
          className="h-8 w-8"
          width={32}
          height={32}
        />
        <span className="text-2xl font-bold text-orange-700">{count}개</span>
      </div>
      <p className="text-orange-600">보유 중인 곶감</p>
    </section>
  );
}
