import type { BeadPackage } from "@/lib/payments/packages";

export interface BeadPageStatusState {
  hasHydrated: boolean;
  userId: string | undefined;
}

export interface BeadPageFeedbackState {
  type: "error" | "success";
  message: string;
  actionLabel?: string;
}

export interface BeadPageState {
  tossClientKey: string | null;
  beadCount: number;
  packages: BeadPackage[];
  isLoading: boolean;
  selectedPackageId: string | null;
  pageFeedback: BeadPageFeedbackState | null;
}

export interface BeadPageHandlers {
  onPurchase: (pkg: BeadPackage) => void;
  onOpenPaymentHistory: () => void;
  onFeedbackAction: () => void;
}
