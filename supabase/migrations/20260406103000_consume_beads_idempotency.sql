BEGIN;

ALTER TABLE IF EXISTS public.bead_transactions
  ADD COLUMN IF NOT EXISTS request_id text;

CREATE UNIQUE INDEX IF NOT EXISTS bead_transactions_user_request_id_unique
  ON public.bead_transactions (user_id, request_id)
  WHERE request_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.consume_beads(
  p_user_id uuid,
  p_cost integer,
  p_request_id text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_count integer;
  v_existing_amount bigint;
  v_existing_tx_type text;
BEGIN
  IF p_cost < 0 THEN
    RAISE EXCEPTION 'INVALID_COST';
  END IF;

  INSERT INTO public.bead(user_id, count)
  VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  IF p_cost = 0 THEN
    SELECT b.count
    INTO v_next_count
    FROM public.bead b
    WHERE b.user_id = p_user_id;

    RETURN COALESCE(v_next_count, 0);
  END IF;

  IF p_request_id IS NOT NULL THEN
    p_request_id := NULLIF(BTRIM(p_request_id), '');
  END IF;

  IF p_request_id IS NOT NULL THEN
    SELECT bt.amount, bt.transaction_type
    INTO v_existing_amount, v_existing_tx_type
    FROM public.bead_transactions bt
    WHERE bt.user_id = p_user_id
      AND bt.request_id = p_request_id
    ORDER BY bt.id DESC
    LIMIT 1;

    IF FOUND THEN
      IF v_existing_tx_type = 'usage' AND v_existing_amount = -p_cost THEN
        SELECT b.count
        INTO v_next_count
        FROM public.bead b
        WHERE b.user_id = p_user_id;

        RETURN COALESCE(v_next_count, 0);
      END IF;

      RAISE EXCEPTION 'REQUEST_ID_CONFLICT';
    END IF;
  END IF;

  UPDATE public.bead
  SET count = count - p_cost
  WHERE user_id = p_user_id
    AND count >= p_cost
  RETURNING count INTO v_next_count;

  IF v_next_count IS NULL THEN
    RAISE EXCEPTION 'INSUFFICIENT_BEADS';
  END IF;

  INSERT INTO public.bead_transactions(
    user_id,
    amount,
    transaction_type,
    description,
    request_id
  )
  VALUES (
    p_user_id,
    -p_cost,
    'usage',
    'consume_beads',
    p_request_id
  );

  RETURN v_next_count;
EXCEPTION
  WHEN unique_violation THEN
    IF p_request_id IS NOT NULL THEN
      SELECT b.count
      INTO v_next_count
      FROM public.bead b
      WHERE b.user_id = p_user_id;

      RETURN COALESCE(v_next_count, 0);
    END IF;

    RAISE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_beads(uuid, integer, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consume_beads(uuid, integer, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.consume_beads(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_beads(uuid, integer, text) TO service_role;

COMMIT;
