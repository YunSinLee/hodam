DO $$ DECLARE v_signature text; v_role text; BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.handle_new_user()',
    'public.hodam_security_smoke_check()',
    'public.hodam_security_grants_smoke_check()',
    'public.hodam_security_integrity_smoke_check()',
    'public.register_webhook_transmission(text,text,text,timestamp with time zone,integer)'
  ] LOOP
    FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF has_function_privilege(v_role, v_signature, 'EXECUTE') THEN
        RAISE EXCEPTION 'Unneeded executable function remains: % %', v_role, v_signature;
      END IF;
    END LOOP;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM public.hodam_security_smoke_check()
    WHERE check_name = 'grant_execute_deny.finalize_payment.authenticated' AND ok) THEN
    RAISE EXCEPTION 'Base smoke check still requires the unsafe payment grant';
  END IF;
END; $$;

INSERT INTO public.payment_history(id, user_id, order_id) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'surface-order-1'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'surface-order-2');
SET ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', false);
DO $$ BEGIN
  IF NOT public.register_webhook_transmission('surface-transmission-1', 'surface-order-1') THEN
    RAISE EXCEPTION 'Server webhook registration blocked';
  END IF;
  IF public.register_webhook_transmission('surface-transmission-1', 'surface-order-1') THEN
    RAISE EXCEPTION 'Duplicate webhook registration accepted';
  END IF;
  PERFORM public.register_webhook_transmission('surface-transmission-2', 'surface-order-2');
  PERFORM 1 FROM public.hodam_security_smoke_check();
  PERFORM 1 FROM public.hodam_security_grants_smoke_check();
  PERFORM 1 FROM public.hodam_security_integrity_smoke_check();
END; $$;
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
DO $$ BEGIN
  BEGIN
    PERFORM public.register_webhook_transmission('preempted-webhook-id', 'surface-order-2');
    RAISE EXCEPTION 'User can still preempt a webhook transmission ID';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  IF EXISTS (SELECT 1 FROM public.get_my_threads() WHERE user_id <> auth.uid()) THEN
    RAISE EXCEPTION 'Other user book visible through get_my_threads';
  END IF;
  IF EXISTS (SELECT 1 FROM public.get_thread_detail(202)) THEN
    RAISE EXCEPTION 'Other user book visible through get_thread_detail';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.get_thread_detail(101)) THEN
    RAISE EXCEPTION 'Own book not readable';
  END IF;
  IF (SELECT count(*) FROM public.get_payment_webhook_transmissions('surface-order-1', auth.uid())) <> 1 THEN
    RAISE EXCEPTION 'Own payment timeline not readable';
  END IF;
  IF EXISTS (SELECT 1 FROM public.get_payment_webhook_transmissions('surface-order-2', auth.uid())) THEN
    RAISE EXCEPTION 'Other payment timeline leaked';
  END IF;
  BEGIN
    PERFORM 1 FROM public.get_payment_webhook_transmissions('surface-order-2', '22222222-2222-4222-8222-222222222222');
    RAISE EXCEPTION 'Caller can substitute another payment owner';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'PAYMENT_USER_MISMATCH' THEN RAISE; END IF; END;
  -- Trigger execution still works even though direct client EXECUTE is revoked.
  INSERT INTO auth.users (id, email, raw_user_meta_data)
    VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'synthetic@example.invalid', '{"name":"Synthetic"}');
END; $$;
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc') THEN
    RAISE EXCEPTION 'Signup trigger was broken by grant cleanup';
  END IF;
  IF EXISTS (SELECT 1 FROM public.payment_webhook_transmissions WHERE transmission_id = 'preempted-webhook-id') THEN
    RAISE EXCEPTION 'Unauthorized webhook registry row written';
  END IF;
END; $$;

SET ROLE anon;
SELECT set_config('request.jwt.claim.role', 'anon', false);
SELECT set_config('request.jwt.claim.sub', '', false);
DO $$ DECLARE v_ms bigint := (extract(epoch from now()) * 1000)::bigint; BEGIN
  IF public.record_auth_callback_metric('security_smoke_invalid_stage', '/auth/callback', 0, '{}') THEN
    RAISE EXCEPTION 'Invalid-stage smoke request was accepted';
  END IF;
  IF NOT public.record_auth_callback_metric('flow_start', '/auth/callback', v_ms,
    '{"oauthAttemptId":"synthetic-surface-attempt","provider":"google","privateChildName":"must-not-be-saved"}') THEN
    RAISE EXCEPTION 'Pre-login telemetry fallback was blocked';
  END IF;
  IF (SELECT count(*) FROM public.get_auth_callback_metrics_by_attempt('synthetic-surface-attempt', 1)) <> 1 THEN
    RAISE EXCEPTION 'Exact-attempt pre-login diagnostics blocked';
  END IF;
  IF EXISTS (SELECT 1 FROM public.get_auth_callback_metrics_by_attempt('different-surface-attempt', 61)) THEN
    RAISE EXCEPTION 'Attempt diagnostics leaked another attempt';
  END IF;
  IF EXISTS (SELECT 1 FROM public.get_auth_callback_metrics_by_attempt('synthetic-surface-attempt', 61) WHERE details ? 'privateChildName') THEN
    RAISE EXCEPTION 'Telemetry writer retained a non-allowlisted field';
  END IF;
END; $$;
RESET ROLE;
SELECT 'Client RPC surface, webhook registry, trigger continuity, owned reads and pre-login diagnostics assertions passed' AS result;
