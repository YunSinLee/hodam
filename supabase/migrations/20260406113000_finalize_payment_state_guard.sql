BEGIN;

CREATE OR REPLACE FUNCTION public.finalize_payment(
  p_order_id text,
  p_payment_key text,
  p_user_id uuid
)
RETURNS TABLE (bead_count integer, already_processed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.payment_history%ROWTYPE;
  v_normalized_payment_key text;
BEGIN
  v_normalized_payment_key := NULLIF(BTRIM(p_payment_key), '');
  IF v_normalized_payment_key IS NULL THEN
    RAISE EXCEPTION 'PAYMENT_KEY_REQUIRED';
  END IF;

  SELECT *
  INTO v_payment
  FROM public.payment_history
  WHERE order_id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_NOT_FOUND';
  END IF;

  IF v_payment.user_id <> p_user_id THEN
    RAISE EXCEPTION 'PAYMENT_USER_MISMATCH';
  END IF;

  IF v_payment.status = 'cancelled' THEN
    RAISE EXCEPTION 'PAYMENT_CANCELLED';
  END IF;

  IF v_payment.payment_key IS NOT NULL
     AND v_payment.payment_key <> v_normalized_payment_key THEN
    RAISE EXCEPTION 'PAYMENT_KEY_MISMATCH';
  END IF;

  IF v_payment.status = 'completed' THEN
    SELECT b.count INTO bead_count
    FROM public.bead b
    WHERE b.user_id = p_user_id;

    bead_count := COALESCE(bead_count, 0);
    already_processed := TRUE;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_payment.status NOT IN ('pending', 'failed') THEN
    RAISE EXCEPTION 'PAYMENT_INVALID_STATUS_TRANSITION';
  END IF;

  UPDATE public.payment_history
  SET status = 'completed',
      payment_key = COALESCE(payment_key, v_normalized_payment_key),
      completed_at = COALESCE(completed_at, now()),
      credited_at = COALESCE(credited_at, now()),
      credited_user_id = COALESCE(credited_user_id, p_user_id)
  WHERE id = v_payment.id
    AND status IN ('pending', 'failed');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_INVALID_STATUS_TRANSITION';
  END IF;

  INSERT INTO public.bead(user_id, count)
  VALUES (p_user_id, v_payment.bead_quantity)
  ON CONFLICT (user_id)
  DO UPDATE SET count = public.bead.count + EXCLUDED.count
  RETURNING count INTO bead_count;

  already_processed := FALSE;
  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.finalize_payment(text, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.finalize_payment(text, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.finalize_payment(text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_payment(text, text, uuid) TO service_role;

COMMIT;
