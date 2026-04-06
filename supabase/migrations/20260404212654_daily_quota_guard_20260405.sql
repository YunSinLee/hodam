BEGIN;

CREATE OR REPLACE FUNCTION public.consume_daily_quota(
  p_user_id uuid,
  p_action text,
  p_cost integer,
  p_daily_limit integer,
  p_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  allowed boolean,
  used integer,
  remaining integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.consume_daily_quota(uuid, text, integer, integer, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_daily_quota(uuid, text, integer, integer, jsonb) TO authenticated;

COMMIT;
