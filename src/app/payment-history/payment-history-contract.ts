import type { PaymentHistory, PaymentTimeline } from "@/lib/client/api/payment";
import type { PaymentHistoryFilter } from "@/lib/ui/payment-history";

export type PaymentHistoryErrorActionType = "goSignIn" | "retry";

export interface PaymentHistoryPageState {
  isLoading: boolean;
  isAuthReady: boolean;
}

export interface PaymentHistoryPageHandlers {
  onBack: () => void;
}

export interface PaymentHistoryErrorState {
  message: string;
  actionLabel?: string;
}

export interface PaymentHistoryErrorHandlers {
  onAction: () => void;
}

export interface PaymentHistoryFilterState {
  filter: PaymentHistoryFilter;
}

export interface PaymentHistoryFilterHandlers {
  onFilterChange: (filter: PaymentHistoryFilter) => void;
}

export interface PaymentHistoryStatsState {
  totalAmount: number;
  totalBeads: number;
  totalCount: number;
}

export interface PaymentHistoryListState {
  payments: PaymentHistory[];
  filter: PaymentHistoryFilter;
  selectedOrderId: string | null;
  timelineLoadingOrderId: string | null;
}

export interface PaymentHistoryListHandlers {
  onGoBead: () => void;
  onOpenTimeline: (orderId: string, paymentFlowId?: string | null) => void;
}

export interface PaymentHistoryFormatters {
  formatDate: (dateString: string) => string;
  formatCurrency: (amount: number) => string;
}

export interface PaymentTimelinePanelState {
  isOpen: boolean;
  isLoading: boolean;
  orderId: string | null;
  paymentFlowId: string | null;
  status: PaymentHistory["status"] | null;
  events: PaymentTimeline["events"];
  errorMessage: string | null;
}

export interface PaymentTimelinePanelHandlers {
  onClose: () => void;
  onRetry: () => void;
}
