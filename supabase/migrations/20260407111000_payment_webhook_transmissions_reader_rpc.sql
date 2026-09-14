BEGIN;

CREATE INDEX IF NOT EXISTS payment_webhook_transmissions_order_created_at_idx
  ON public.payment_webhook_transmissions (order_id, created_at ASC);

CREATE OR REPLACE FUNCTION public.get_payment_webhook_transmissions(
  p_order_id text,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  transmission_id text,
  order_id text,
  event_type text,
  transmission_time timestamptz,
  retried_count integer,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id text;
  v_effective_user_id uuid;
  v_caller_role text;
BEGIN
  v_order_id := NULLIF(BTRIM(p_order_id), '');
  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'ORDER_ID_REQUIRED';
  END IF;

  v_caller_role := auth.role();

  IF v_caller_role = 'service_role' THEN
    v_effective_user_id := p_user_id;
  ELSE
    v_effective_user_id := auth.uid();
    IF p_user_id IS NOT NULL AND p_user_id <> v_effective_user_id THEN
      RAISE EXCEPTION 'PAYMENT_USER_MISMATCH';
    END IF;
  END IF;

  IF v_effective_user_id IS NULL THEN
    RAISE EXCEPTION 'PAYMENT_USER_REQUIRED';
  END IF;

  RETURN QUERY
  SELECT
    wt.transmission_id,
    wt.order_id,
    wt.event_type,
    wt.transmission_time,
    wt.retried_count,
    wt.created_at
  FROM public.payment_webhook_transmissions wt
  INNER JOIN public.payment_history ph
    ON ph.order_id = wt.order_id
  WHERE wt.order_id = v_order_id
    AND ph.user_id = v_effective_user_id
  ORDER BY wt.created_at ASC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_payment_webhook_transmissions(text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_payment_webhook_transmissions(text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_payment_webhook_transmissions(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_payment_webhook_transmissions(text, uuid) TO service_role;

COMMIT;
