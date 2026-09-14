BEGIN;

ALTER TABLE IF EXISTS public.payment_history
  ADD COLUMN IF NOT EXISTS payment_flow_id text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payment_history_payment_flow_id_format'
  ) THEN
    ALTER TABLE public.payment_history
      ADD CONSTRAINT payment_history_payment_flow_id_format
      CHECK (
        payment_flow_id IS NULL
        OR payment_flow_id ~ '^[A-Za-z0-9._:-]{1,128}$'
      );
  END IF;
END
$$;

-- Backfill existing rows for easier production diagnostics.
UPDATE public.payment_history
SET payment_flow_id = 'order:' || LEFT(REGEXP_REPLACE(order_id, '[^A-Za-z0-9._:-]', '_', 'g'), 122)
WHERE payment_flow_id IS NULL
  AND NULLIF(BTRIM(order_id), '') IS NOT NULL;

CREATE INDEX IF NOT EXISTS payment_history_payment_flow_id_created_at_idx
  ON public.payment_history (payment_flow_id, created_at DESC)
  WHERE payment_flow_id IS NOT NULL;

COMMIT;
