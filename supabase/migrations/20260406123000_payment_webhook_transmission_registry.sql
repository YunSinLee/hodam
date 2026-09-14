BEGIN;

CREATE TABLE IF NOT EXISTS public.payment_webhook_transmissions (
  transmission_id text PRIMARY KEY,
  order_id text,
  event_type text,
  transmission_time timestamptz,
  retried_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS public.payment_webhook_transmissions
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS payment_webhook_transmissions_created_at_idx
  ON public.payment_webhook_transmissions (created_at DESC);

CREATE OR REPLACE FUNCTION public.register_webhook_transmission(
  p_transmission_id text,
  p_order_id text DEFAULT NULL,
  p_event_type text DEFAULT NULL,
  p_transmission_time timestamptz DEFAULT NULL,
  p_retried_count integer DEFAULT 0
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted text;
BEGIN
  p_transmission_id := NULLIF(BTRIM(p_transmission_id), '');
  IF p_transmission_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_TRANSMISSION_ID';
  END IF;

  INSERT INTO public.payment_webhook_transmissions(
    transmission_id,
    order_id,
    event_type,
    transmission_time,
    retried_count
  )
  VALUES (
    p_transmission_id,
    NULLIF(BTRIM(p_order_id), ''),
    NULLIF(BTRIM(p_event_type), ''),
    p_transmission_time,
    GREATEST(COALESCE(p_retried_count, 0), 0)
  )
  ON CONFLICT (transmission_id) DO NOTHING
  RETURNING transmission_id
  INTO v_inserted;

  RETURN v_inserted IS NOT NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.register_webhook_transmission(text, text, text, timestamptz, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.register_webhook_transmission(text, text, text, timestamptz, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.register_webhook_transmission(text, text, text, timestamptz, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_webhook_transmission(text, text, text, timestamptz, integer) TO service_role;

COMMIT;
