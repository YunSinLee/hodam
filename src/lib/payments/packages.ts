export interface BeadPackage {
  id: string;
  quantity: number;
  price: number;
  originalPrice: number;
  discount: number;
  popular: boolean;
  description: string;
}

export const BEAD_PACKAGES: BeadPackage[] = [
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

export function findBeadPackageById(packageId: string) {
  return BEAD_PACKAGES.find(item => item.id === packageId) || null;
}
