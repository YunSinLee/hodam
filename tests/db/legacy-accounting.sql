-- Legacy functions inspected read-only on 2026-09-14. Only used in an isolated local test database.
CREATE OR REPLACE FUNCTION public.consume_beads(p_user_id uuid, p_cost integer, p_request_id text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.consume_daily_quota(p_user_id uuid, p_action text, p_cost integer, p_daily_limit integer, p_meta jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(allowed boolean, used integer, remaining integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_today_start timestamptz;
  v_used integer;
  v_lock_key bigint;
BEGIN
  IF p_cost < 0 THEN
    RAISE EXCEPTION 'INVALID_COST';
  END IF;

  IF p_daily_limit < 0 THEN
    RAISE EXCEPTION 'INVALID_DAILY_LIMIT';
  END IF;

  v_today_start := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_lock_key := hashtext(
    p_user_id::text || ':' || p_action || ':' || to_char(v_today_start, 'YYYY-MM-DD')
  )::bigint;

  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT COALESCE(
    SUM(
      CASE
        WHEN jsonb_typeof(details -> 'cost') = 'number' THEN (details ->> 'cost')::integer
        WHEN jsonb_typeof(details -> 'cost') = 'string'
             AND (details ->> 'cost') ~ '^[0-9]+$' THEN (details ->> 'cost')::integer
        ELSE 0
      END
    ),
    0
  )::integer
  INTO v_used
  FROM public.user_activity_logs
  WHERE user_id = p_user_id
    AND action = p_action
    AND created_at >= v_today_start;

  IF v_used + p_cost > p_daily_limit THEN
    allowed := FALSE;
    used := v_used;
    remaining := GREATEST(p_daily_limit - v_used, 0);
    RETURN NEXT;
    RETURN;
  END IF;

  INSERT INTO public.user_activity_logs (user_id, action, details)
  VALUES (
    p_user_id,
    p_action,
    COALESCE(p_meta, '{}'::jsonb) || jsonb_build_object(
      'cost', p_cost,
      'daily_limit', p_daily_limit,
      'used_before', v_used
    )
  );

  allowed := TRUE;
  used := v_used + p_cost;
  remaining := GREATEST(p_daily_limit - (v_used + p_cost), 0);
  RETURN NEXT;
END;
$function$;

