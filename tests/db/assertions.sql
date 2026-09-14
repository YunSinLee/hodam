DO $$ BEGIN
  IF has_function_privilege('anon', 'public.credit_beads(uuid,integer)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.credit_beads(uuid,integer)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.finalize_payment(text,text,uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.consume_daily_quota(uuid,text,integer,integer,jsonb)', 'EXECUTE')
     OR has_table_privilege('authenticated', 'public.payment_history', 'INSERT')
     OR has_table_privilege('authenticated', 'public.payment_history', 'UPDATE') THEN
    RAISE EXCEPTION 'Browser can still alter payment accounting';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.finalize_payment(text,text,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Server lost payment finalization access';
  END IF;
END; $$;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
DO $$ DECLARE result record; BEGIN
  IF public.consume_beads(auth.uid(), 1, 'same-request') <> 9 THEN RAISE EXCEPTION 'Debit failed'; END IF;
  IF public.consume_beads(auth.uid(), 1, 'same-request') <> 9 THEN RAISE EXCEPTION 'Duplicate debit'; END IF;
  BEGIN
    PERFORM public.consume_beads('22222222-2222-4222-8222-222222222222', 1, 'attack');
    RAISE EXCEPTION 'Expected ownership denial';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'FORBIDDEN' THEN RAISE; END IF; END;
  SELECT * INTO result FROM public.consume_daily_quota(auth.uid(), 'picturebook_start', 1, 1);
  IF NOT result.allowed THEN RAISE EXCEPTION 'First quota failed'; END IF;
  SELECT * INTO result FROM public.consume_daily_quota(auth.uid(), 'picturebook_start', 1, 1);
  IF result.allowed THEN RAISE EXCEPTION 'Quota exceeded'; END IF;
  BEGIN
    PERFORM public.consume_daily_quota('22222222-2222-4222-8222-222222222222', 'picturebook_start', 1, 1);
    RAISE EXCEPTION 'Expected quota ownership denial';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'FORBIDDEN' THEN RAISE; END IF; END;
END; $$;
SELECT set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', false);
DO $$ BEGIN
  BEGIN
    INSERT INTO public.bead VALUES (auth.uid(), 999999);
    RAISE EXCEPTION 'Initial credit could be forged';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  INSERT INTO public.bead(user_id) VALUES (auth.uid());
END; $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count FROM public.bead WHERE user_id = '22222222-2222-4222-8222-222222222222') <> 10 THEN RAISE EXCEPTION 'Other user was debited'; END IF;
  INSERT INTO public.thread(user_id, openai_thread_id) VALUES ('11111111-1111-4111-8111-111111111111', 'picturebook_repeated');
  BEGIN
    INSERT INTO public.thread(user_id, openai_thread_id) VALUES ('11111111-1111-4111-8111-111111111111', 'picturebook_repeated');
    RAISE EXCEPTION 'Concurrent request not deduplicated';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.payment_webhook_transmissions'::regclass) THEN RAISE EXCEPTION 'Webhook RLS missing'; END IF;
END; $$;
SELECT 'Accounting migration assertions passed' AS result;
