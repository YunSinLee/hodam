-- Align payment timeline lookup index with actual access pattern:
-- WHERE user_id = ? AND payment_flow_id = ? ORDER BY created_at DESC LIMIT 1

DROP INDEX IF EXISTS public.payment_history_payment_flow_id_created_at_idx;

CREATE INDEX IF NOT EXISTS payment_history_user_flow_created_at_idx
  ON public.payment_history (user_id, payment_flow_id, created_at DESC)
  WHERE payment_flow_id IS NOT NULL;

