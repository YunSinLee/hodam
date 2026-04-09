import { randomUUID } from "crypto";

import { SupabaseClient } from "@supabase/supabase-js";

export interface PaymentHistoryRow {
  id: string;
  user_id: string;
  order_id: string;
  payment_key?: string;
  payment_flow_id?: string | null;
  amount: number;
  bead_quantity: number;
  status: "pending" | "completed" | "failed" | "cancelled";
  created_at: string;
  completed_at?: string;
  credited_at?: string | null;
  credited_user_id?: string | null;
}

export interface PaymentWebhookTransmissionRow {
  transmission_id: string;
  order_id: string | null;
  event_type: string | null;
  transmission_time: string | null;
  retried_count: number;
  created_at: string;
}

interface RegisterWebhookTransmissionInput {
  transmissionId: string;
  orderId?: string | null;
  eventType?: string | null;
  transmissionTime?: string | null;
  retriedCount?: number;
}

export type PaymentDomainErrorCode =
  | "PAYMENT_NOT_FOUND"
  | "PAYMENT_USER_MISMATCH"
  | "PAYMENT_KEY_REQUIRED"
  | "PAYMENT_KEY_MISMATCH"
  | "PAYMENT_CANCELLED"
  | "PAYMENT_INVALID_STATUS_TRANSITION";

const KNOWN_PAYMENT_RPC_ERRORS: PaymentDomainErrorCode[] = [
  "PAYMENT_NOT_FOUND",
  "PAYMENT_USER_MISMATCH",
  "PAYMENT_KEY_REQUIRED",
  "PAYMENT_KEY_MISMATCH",
  "PAYMENT_CANCELLED",
  "PAYMENT_INVALID_STATUS_TRANSITION",
];

export class PaymentDomainError extends Error {
  readonly code: PaymentDomainErrorCode;

  constructor(code: PaymentDomainErrorCode) {
    super(code);
    this.name = "PaymentDomainError";
    this.code = code;
  }
}

export function createOrderId(prefix: string = "HODAM") {
  const now = Date.now();
  return `${prefix}_${now}_${randomUUID().slice(0, 8)}`;
}

function toKnownPaymentDomainError(
  message: string | undefined,
): PaymentDomainError | null {
  if (!message) return null;
  const matched = KNOWN_PAYMENT_RPC_ERRORS.find(code => message.includes(code));
  return matched ? new PaymentDomainError(matched) : null;
}

export async function createPendingPayment(
  admin: SupabaseClient,
  input: {
    userId: string;
    orderId: string;
    amount: number;
    beadQuantity: number;
    paymentFlowId?: string | null;
  },
) {
  const paymentFlowId =
    typeof input.paymentFlowId === "string" &&
    input.paymentFlowId.trim().length > 0
      ? input.paymentFlowId.trim()
      : null;

  const { data, error } = await admin
    .from("payment_history")
    .insert({
      user_id: input.userId,
      order_id: input.orderId,
      payment_flow_id: paymentFlowId,
      amount: input.amount,
      bead_quantity: input.beadQuantity,
      status: "pending",
    })
    .select("*")
    .single();

  if (error || !data) {
    throw error || new Error("Failed to create pending payment");
  }

  return data as PaymentHistoryRow;
}

export async function getPaymentByOrderId(
  admin: SupabaseClient,
  orderId: string,
): Promise<PaymentHistoryRow | null> {
  const { data, error } = await admin
    .from("payment_history")
    .select("*")
    .eq("order_id", orderId)
    .single();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  if (!data) return null;
  return data as PaymentHistoryRow;
}

export async function getLatestPaymentByFlowId(
  admin: SupabaseClient,
  userId: string,
  paymentFlowId: string,
): Promise<PaymentHistoryRow | null> {
  const normalizedFlowId = paymentFlowId.trim();
  if (!normalizedFlowId) {
    return null;
  }

  const { data, error } = await admin
    .from("payment_history")
    .select("*")
    .eq("user_id", userId)
    .eq("payment_flow_id", normalizedFlowId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return data as PaymentHistoryRow;
}

export async function listPaymentsByUser(
  admin: SupabaseClient,
  userId: string,
): Promise<PaymentHistoryRow[]> {
  const { data, error } = await admin
    .from("payment_history")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as PaymentHistoryRow[];
}

export async function findRecentPendingPayment(
  admin: SupabaseClient,
  input: {
    userId: string;
    amount: number;
    beadQuantity: number;
    lookbackMinutes?: number;
  },
): Promise<PaymentHistoryRow | null> {
  const lookbackMinutes = Number.isFinite(input.lookbackMinutes)
    ? Math.max(1, Number(input.lookbackMinutes))
    : 5;
  const cutoff = new Date(Date.now() - lookbackMinutes * 60_000).toISOString();

  const { data, error } = await admin
    .from("payment_history")
    .select("*")
    .eq("user_id", input.userId)
    .eq("amount", input.amount)
    .eq("bead_quantity", input.beadQuantity)
    .eq("status", "pending")
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) return null;
  return data as PaymentHistoryRow;
}

export async function registerWebhookTransmission(
  admin: SupabaseClient,
  input: RegisterWebhookTransmissionInput,
): Promise<boolean> {
  const retriedCount = Number.isFinite(input.retriedCount)
    ? Math.max(0, Number(input.retriedCount))
    : 0;

  const { data, error } = await admin.rpc("register_webhook_transmission", {
    p_transmission_id: input.transmissionId,
    p_order_id: input.orderId || null,
    p_event_type: input.eventType || null,
    p_transmission_time: input.transmissionTime || null,
    p_retried_count: retriedCount,
  });

  if (error) {
    throw error;
  }

  if (typeof data === "boolean") {
    return data;
  }

  if (Array.isArray(data) && data.length > 0) {
    return Boolean(data[0]);
  }

  return Boolean(data);
}

export async function listWebhookTransmissionsByOrder(
  admin: SupabaseClient,
  orderId: string,
  userId: string,
): Promise<PaymentWebhookTransmissionRow[]> {
  const { data, error } = await admin.rpc("get_payment_webhook_transmissions", {
    p_order_id: orderId,
    p_user_id: userId,
  });

  if (error) {
    throw error;
  }

  if (!Array.isArray(data)) {
    return [];
  }
  return data as PaymentWebhookTransmissionRow[];
}

export async function settlePaymentAndCredit(
  admin: SupabaseClient,
  payment: PaymentHistoryRow,
  paymentKey: string,
): Promise<{ beadCount: number; alreadyProcessed: boolean }> {
  const { data, error } = await admin.rpc("finalize_payment", {
    p_order_id: payment.order_id,
    p_payment_key: paymentKey,
    p_user_id: payment.user_id,
  });

  if (error) {
    const mapped = toKnownPaymentDomainError(
      typeof error.message === "string" ? error.message : undefined,
    );
    if (mapped) {
      throw mapped;
    }
    throw error;
  }

  const row = Array.isArray(data)
    ? (data[0] as { bead_count?: number; already_processed?: boolean })
    : null;

  if (!row) {
    throw new Error("Failed to finalize payment");
  }

  return {
    beadCount: Number(row.bead_count || 0),
    alreadyProcessed: Boolean(row.already_processed),
  };
}

export async function markPaymentFailed(
  admin: SupabaseClient,
  orderId: string,
) {
  await admin
    .from("payment_history")
    .update({ status: "failed" })
    .eq("order_id", orderId)
    .eq("status", "pending");
}
