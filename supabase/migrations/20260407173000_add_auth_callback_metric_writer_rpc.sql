BEGIN;

CREATE OR REPLACE FUNCTION public.record_auth_callback_metric(
  p_stage text,
  p_callback_path text,
  p_timestamp_ms bigint,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage text;
  v_callback_path text;
  v_timestamp_ms bigint;
  v_action text;
  v_details jsonb;
BEGIN
  v_stage := btrim(COALESCE(p_stage, ''));
  IF v_stage NOT IN (
    'flow_start',
    'payload_parsed',
    'oauth_error',
    'no_payload_session_check_start',
    'no_payload_session_recovered',
    'wait_for_session_start',
    'wait_for_session_complete',
    'exchange_start',
    'exchange_complete',
    'exchange_terminal_error',
    'set_session_start',
    'set_session_complete',
    'callback_success',
    'callback_error',
    'fallback_timeout_triggered'
  ) THEN
    RETURN FALSE;
  END IF;

  v_callback_path := left(
    COALESCE(NULLIF(btrim(p_callback_path), ''), '/auth/callback'),
    256
  );
  IF left(v_callback_path, 14) <> '/auth/callback' THEN
    RETURN FALSE;
  END IF;

  v_timestamp_ms := COALESCE(p_timestamp_ms, 0);
  IF v_timestamp_ms <= 0 THEN
    RETURN FALSE;
  END IF;

  IF to_timestamp(v_timestamp_ms::double precision / 1000.0) < now() - interval '7 days'
    OR to_timestamp(v_timestamp_ms::double precision / 1000.0) > now() + interval '1 day' THEN
    RETURN FALSE;
  END IF;

  v_details := COALESCE(p_details, '{}'::jsonb);
  IF jsonb_typeof(v_details) <> 'object' THEN
    v_details := '{}'::jsonb;
  END IF;

  v_action :=
    CASE
      WHEN v_stage = 'callback_success' THEN 'auth_callback_success'
      WHEN v_stage IN ('oauth_error', 'exchange_terminal_error', 'callback_error', 'fallback_timeout_triggered')
        THEN 'auth_callback_error'
      ELSE 'auth_callback_event'
    END;

  INSERT INTO public.user_activity_logs (action, details, created_at)
  VALUES (
    v_action,
    jsonb_build_object(
      'stage', v_stage,
      'callbackPath', v_callback_path,
      'timestampMs', v_timestamp_ms
    ) || v_details,
    now()
  );

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.record_auth_callback_metric(text, text, bigint, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_auth_callback_metric(text, text, bigint, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.record_auth_callback_metric(text, text, bigint, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_auth_callback_metric(text, text, bigint, jsonb) TO service_role;

COMMIT;
