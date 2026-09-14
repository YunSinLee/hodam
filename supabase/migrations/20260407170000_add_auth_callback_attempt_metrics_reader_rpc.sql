BEGIN;

CREATE OR REPLACE FUNCTION public.get_auth_callback_metrics_by_attempt(
  p_attempt_id text,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  action text,
  details jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt_id text;
  v_limit integer;
BEGIN
  v_attempt_id := btrim(COALESCE(p_attempt_id, ''));
  IF v_attempt_id = '' THEN
    RETURN;
  END IF;

  IF length(v_attempt_id) < 8 OR length(v_attempt_id) > 128 THEN
    RETURN;
  END IF;

  IF v_attempt_id !~ '^[A-Za-z0-9._:-]+$' THEN
    RETURN;
  END IF;

  v_limit := GREATEST(1, LEAST(COALESCE(p_limit, 20), 61));

  RETURN QUERY
  SELECT
    l.action::text,
    COALESCE(l.details, '{}'::jsonb),
    l.created_at
  FROM public.user_activity_logs l
  WHERE l.action IN (
    'auth_callback_event',
    'auth_callback_success',
    'auth_callback_error'
  )
    AND l.created_at >= now() - interval '24 hours'
    AND l.details ? 'oauthAttemptId'
    AND l.details->>'oauthAttemptId' = v_attempt_id
  ORDER BY l.created_at DESC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_auth_callback_metrics_by_attempt(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_auth_callback_metrics_by_attempt(text, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.get_auth_callback_metrics_by_attempt(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_callback_metrics_by_attempt(text, integer) TO service_role;

COMMIT;
