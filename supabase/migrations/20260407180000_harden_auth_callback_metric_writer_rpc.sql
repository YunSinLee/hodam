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
  v_raw_details jsonb;
  v_details jsonb := '{}'::jsonb;
  v_provider text;
  v_oauth_attempt_id text;
  v_source text;
  v_redirect_target text;
  v_recovery_code text;
  v_event text;
  v_retries bigint;
  v_wait_ms bigint;
  v_marker_age_ms bigint;
  v_already_exists boolean;
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

  v_raw_details := COALESCE(p_details, '{}'::jsonb);
  IF jsonb_typeof(v_raw_details) <> 'object' THEN
    v_raw_details := '{}'::jsonb;
  END IF;

  IF jsonb_typeof(v_raw_details -> 'provider') = 'string' THEN
    v_provider := lower(left(btrim(v_raw_details ->> 'provider'), 32));
    IF v_provider IN ('google', 'kakao') THEN
      v_details := v_details || jsonb_build_object('provider', v_provider);
    END IF;
  END IF;

  IF jsonb_typeof(v_raw_details -> 'oauthAttemptId') = 'string' THEN
    v_oauth_attempt_id := btrim(v_raw_details ->> 'oauthAttemptId');
    IF length(v_oauth_attempt_id) BETWEEN 8 AND 128
      AND v_oauth_attempt_id ~ '^[A-Za-z0-9._:-]+$' THEN
      v_details := v_details || jsonb_build_object('oauthAttemptId', v_oauth_attempt_id);
    ELSE
      v_oauth_attempt_id := NULL;
    END IF;
  END IF;

  IF jsonb_typeof(v_raw_details -> 'source') = 'string' THEN
    v_source := btrim(v_raw_details ->> 'source');
    IF length(v_source) BETWEEN 1 AND 64
      AND v_source ~ '^[A-Za-z0-9._:-]+$' THEN
      v_details := v_details || jsonb_build_object('source', v_source);
    END IF;
  END IF;

  IF jsonb_typeof(v_raw_details -> 'event') = 'string' THEN
    v_event := btrim(v_raw_details ->> 'event');
    IF length(v_event) BETWEEN 1 AND 64
      AND v_event ~ '^[A-Za-z0-9._:-]+$' THEN
      v_details := v_details || jsonb_build_object('event', v_event);
    END IF;
  END IF;

  IF jsonb_typeof(v_raw_details -> 'recoveryCode') = 'string' THEN
    v_recovery_code := btrim(v_raw_details ->> 'recoveryCode');
    IF length(v_recovery_code) BETWEEN 1 AND 64
      AND v_recovery_code ~ '^[A-Za-z0-9._:-]+$' THEN
      v_details := v_details || jsonb_build_object('recoveryCode', v_recovery_code);
    END IF;
  END IF;

  IF jsonb_typeof(v_raw_details -> 'redirectTarget') = 'string' THEN
    v_redirect_target := left(btrim(v_raw_details ->> 'redirectTarget'), 200);
    IF left(v_redirect_target, 1) = '/' THEN
      v_details := v_details || jsonb_build_object('redirectTarget', v_redirect_target);
    END IF;
  END IF;

  IF jsonb_typeof(v_raw_details -> 'retries') = 'number' THEN
    v_retries := floor((v_raw_details ->> 'retries')::numeric)::bigint;
    IF v_retries BETWEEN 0 AND 100 THEN
      v_details := v_details || jsonb_build_object('retries', v_retries);
    END IF;
  END IF;

  IF jsonb_typeof(v_raw_details -> 'waitMs') = 'number' THEN
    v_wait_ms := floor((v_raw_details ->> 'waitMs')::numeric)::bigint;
    IF v_wait_ms BETWEEN 0 AND 120000 THEN
      v_details := v_details || jsonb_build_object('waitMs', v_wait_ms);
    END IF;
  END IF;

  IF jsonb_typeof(v_raw_details -> 'oauthProviderMarkerAgeMs') = 'number' THEN
    v_marker_age_ms := floor((v_raw_details ->> 'oauthProviderMarkerAgeMs')::numeric)::bigint;
    IF v_marker_age_ms BETWEEN 0 AND 3600000 THEN
      v_details := v_details || jsonb_build_object('oauthProviderMarkerAgeMs', v_marker_age_ms);
    END IF;
  END IF;

  IF jsonb_typeof(v_raw_details -> 'hasCode') = 'boolean' THEN
    v_details := v_details || jsonb_build_object('hasCode', (v_raw_details ->> 'hasCode')::boolean);
  END IF;
  IF jsonb_typeof(v_raw_details -> 'hasTokenPair') = 'boolean' THEN
    v_details := v_details || jsonb_build_object('hasTokenPair', (v_raw_details ->> 'hasTokenPair')::boolean);
  END IF;
  IF jsonb_typeof(v_raw_details -> 'hasCallbackPayload') = 'boolean' THEN
    v_details := v_details || jsonb_build_object('hasCallbackPayload', (v_raw_details ->> 'hasCallbackPayload')::boolean);
  END IF;
  IF jsonb_typeof(v_raw_details -> 'hasOAuthError') = 'boolean' THEN
    v_details := v_details || jsonb_build_object('hasOAuthError', (v_raw_details ->> 'hasOAuthError')::boolean);
  END IF;
  IF jsonb_typeof(v_raw_details -> 'hasSession') = 'boolean' THEN
    v_details := v_details || jsonb_build_object('hasSession', (v_raw_details ->> 'hasSession')::boolean);
  END IF;
  IF jsonb_typeof(v_raw_details -> 'hasError') = 'boolean' THEN
    v_details := v_details || jsonb_build_object('hasError', (v_raw_details ->> 'hasError')::boolean);
  END IF;
  IF jsonb_typeof(v_raw_details -> 'foundSession') = 'boolean' THEN
    v_details := v_details || jsonb_build_object('foundSession', (v_raw_details ->> 'foundSession')::boolean);
  END IF;
  IF jsonb_typeof(v_raw_details -> 'foundUser') = 'boolean' THEN
    v_details := v_details || jsonb_build_object('foundUser', (v_raw_details ->> 'foundUser')::boolean);
  END IF;
  IF jsonb_typeof(v_raw_details -> 'oauthProviderMarkerMissing') = 'boolean' THEN
    v_details := v_details || jsonb_build_object('oauthProviderMarkerMissing', (v_raw_details ->> 'oauthProviderMarkerMissing')::boolean);
  END IF;

  v_action :=
    CASE
      WHEN v_stage = 'callback_success' THEN 'auth_callback_success'
      WHEN v_stage IN ('oauth_error', 'exchange_terminal_error', 'callback_error', 'fallback_timeout_triggered')
        THEN 'auth_callback_error'
      ELSE 'auth_callback_event'
    END;

  IF v_oauth_attempt_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.user_activity_logs l
      WHERE l.action = v_action
        AND l.created_at >= now() - interval '24 hours'
        AND l.details ->> 'oauthAttemptId' = v_oauth_attempt_id
        AND l.details ->> 'stage' = v_stage
        AND l.details ->> 'timestampMs' = v_timestamp_ms::text
      LIMIT 1
    )
    INTO v_already_exists;

    IF v_already_exists THEN
      RETURN TRUE;
    END IF;
  END IF;

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
