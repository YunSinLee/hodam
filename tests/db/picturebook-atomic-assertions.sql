-- Synthetic fixtures in the disposable cluster created by test-migration.sh.
CREATE SCHEMA hodam_test;
GRANT USAGE ON SCHEMA hodam_test TO anon, authenticated, service_role;
CREATE FUNCTION hodam_test.book(p_title text DEFAULT 'Test book', p_pages integer DEFAULT 4)
RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object(
    'kind', 'picturebook', 'status', CASE WHEN p_pages = 4 THEN 'choice-ready' ELSE 'complete' END,
    'title', p_title, 'childName', 'Test child', 'ageBand', '5-7',
    'situation', 'A new school day', 'lesson', 'Small steps', 'tone', 'calm',
    'createdAt', '2026-10-06T00:00:00Z', 'safetyNotes', '[]'::jsonb,
    'pages', (SELECT jsonb_agg(jsonb_build_object(
      'pageNumber', n, 'textKo', 'A quiet step.', 'imagePrompt', 'A safe scene', 'emotionalBeat', 'setup'
    ) ORDER BY n) FROM generate_series(1, p_pages) AS n),
    'choice', jsonb_build_object('afterPage', 4, 'promptKo', 'Which step?', 'options',
      (SELECT jsonb_agg(jsonb_build_object('id', id, 'labelKo', 'Take a step', 'resolutionHint', 'Greet') ORDER BY id)
       FROM unnest(ARRAY['A', 'B', 'C']) AS id))
  );
$$;
CREATE FUNCTION hodam_test.expect_commit_error(p_user uuid, p_request text, p_book jsonb, p_error text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    PERFORM public.commit_picturebook_start(p_user, p_request, p_book);
    RAISE EXCEPTION 'Expected failure: %', p_error;
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> p_error THEN RAISE; END IF;
  END;
END;
$$;

INSERT INTO public.bead(user_id, count) VALUES
  ('44444444-4444-4444-8444-444444444444', 3),
  ('55555555-5555-4555-8555-555555555555', 2),
  ('66666666-6666-4666-8666-666666666666', 0),
  ('77777777-7777-4777-8777-777777777777', 2),
  ('88888888-8888-4888-8888-888888888888', NULL),
  ('88888888-8888-4888-8888-888888888889', 2147483648);

-- Both browser roles are denied even if a caller tries to supply a service JWT
-- claim in this fixture. The real service role can execute the function.
SET ROLE anon;
SELECT set_config('request.jwt.claim.role', 'service_role', false);
DO $$ BEGIN
  BEGIN
    PERFORM public.commit_picturebook_start('44444444-4444-4444-8444-444444444444', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', hodam_test.book());
    RAISE EXCEPTION 'Anonymous atomic write was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.picturebook_storage_ready();
    RAISE EXCEPTION 'Anonymous preflight was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END; $$;
RESET ROLE;
SET ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM public.commit_picturebook_start('44444444-4444-4444-8444-444444444444', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', hodam_test.book());
    RAISE EXCEPTION 'Authenticated atomic write was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.picturebook_storage_ready();
    RAISE EXCEPTION 'Authenticated preflight was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END; $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT hodam_test.expect_commit_error('44444444-4444-4444-8444-444444444444', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', hodam_test.book(), 'FORBIDDEN');
DO $$ BEGIN
  BEGIN
    PERFORM public.picturebook_storage_ready();
    RAISE EXCEPTION 'Preflight accepted a non-service claim';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'FORBIDDEN' THEN RAISE; END IF; END;
END; $$;
SELECT set_config('request.jwt.claim.role', '', false);
SELECT hodam_test.expect_commit_error('44444444-4444-4444-8444-444444444444', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', hodam_test.book(), 'FORBIDDEN');
SELECT set_config('request.jwt.claim.role', 'service_role', false);
SET ROLE service_role;
DO $$ DECLARE saved record; BEGIN
  IF public.picturebook_storage_ready() IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Service preflight did not confirm storage readiness';
  END IF;
  SELECT * INTO STRICT saved FROM public.commit_picturebook_start(
    '44444444-4444-4444-8444-444444444444', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', hodam_test.book('First winner'));
  IF saved.bead_count <> 2 OR saved.thread_id IS NULL OR saved.raw_text::jsonb <> hodam_test.book('First winner') THEN
    RAISE EXCEPTION 'Service role could not atomically save the first book';
  END IF;
END; $$;
RESET ROLE;
BEGIN;
REVOKE EXECUTE ON FUNCTION public.commit_picturebook_start(uuid, text, jsonb) FROM service_role;
DO $$ BEGIN
  IF public.picturebook_storage_ready() IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Preflight ignored a revoked commit grant';
  END IF;
END; $$;
ROLLBACK;
BEGIN;
DROP FUNCTION public.commit_picturebook_start(uuid, text, jsonb);
DO $$ BEGIN
  IF public.picturebook_storage_ready() IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Preflight ignored a missing commit function';
  END IF;
END; $$;
ROLLBACK;
DO $$ DECLARE saved record; first_id bigint; BEGIN
  SELECT id INTO STRICT first_id FROM public.thread WHERE user_id = '44444444-4444-4444-8444-444444444444'
    AND openai_thread_id = 'picturebook_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  SELECT * INTO STRICT saved FROM public.commit_picturebook_start(
    '44444444-4444-4444-8444-444444444444', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', hodam_test.book('Ignored replay'));
  IF saved.thread_id <> first_id OR saved.bead_count <> 2 OR saved.raw_text::jsonb <> hodam_test.book('First winner') THEN
    RAISE EXCEPTION 'Replay changed the first book or charged twice';
  END IF;
  IF (SELECT count(*) FROM public.bead_transactions WHERE user_id = '44444444-4444-4444-8444-444444444444') <> 1
     OR (SELECT amount FROM public.bead_transactions WHERE user_id = '44444444-4444-4444-8444-444444444444') <> -1 THEN
    RAISE EXCEPTION 'Atomic save did not create exactly one usage record';
  END IF;
  -- A completed ending remains the source of truth after a lost start response.
  UPDATE public.thread SET raw_text = hodam_test.book('Finished book', 8)::text WHERE id = first_id;
  UPDATE public.bead SET count = 0 WHERE user_id = '44444444-4444-4444-8444-444444444444';
  SELECT * INTO STRICT saved FROM public.commit_picturebook_start(
    '44444444-4444-4444-8444-444444444444', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', hodam_test.book());
  IF saved.bead_count <> 0 OR saved.raw_text::jsonb <> hodam_test.book('Finished book', 8) THEN
    RAISE EXCEPTION 'A zero balance blocked recovery or an ending was overwritten';
  END IF;
  -- The same request UUID for another account is a separate ownership scope.
  SELECT * INTO STRICT saved FROM public.commit_picturebook_start(
    '55555555-5555-4555-8555-555555555555', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', hodam_test.book('Other owner'));
  IF saved.thread_id = first_id OR saved.bead_count <> 1 OR saved.raw_text::jsonb <> hodam_test.book('Other owner') THEN
    RAISE EXCEPTION 'Request identity crossed user boundaries';
  END IF;
END; $$;

DO $$
DECLARE bad jsonb; field text; before_threads bigint; before_usage bigint; before_balance bigint;
BEGIN
  SELECT count(*) INTO before_threads FROM public.thread;
  SELECT count(*) INTO before_usage FROM public.bead_transactions;
  SELECT sum(count) INTO before_balance FROM public.bead;
  PERFORM hodam_test.expect_commit_error(NULL, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', hodam_test.book(), 'INVALID_PICTUREBOOK_REQUEST');
  PERFORM hodam_test.expect_commit_error('55555555-5555-4555-8555-555555555555', NULL, hodam_test.book(), 'INVALID_PICTUREBOOK_REQUEST');
  PERFORM hodam_test.expect_commit_error('55555555-5555-4555-8555-555555555555', 'not-a-uuid', hodam_test.book(), 'INVALID_PICTUREBOOK_REQUEST');
  FOR bad IN SELECT value FROM (VALUES (NULL::jsonb), ('null'::jsonb), ('[]'::jsonb), ('1'::jsonb), ('{}'::jsonb)) AS invalid(value) LOOP
    PERFORM hodam_test.expect_commit_error('55555555-5555-4555-8555-555555555555', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', bad, 'INVALID_PICTUREBOOK_REQUEST');
  END LOOP;
  FOREACH field IN ARRAY ARRAY['kind', 'status', 'title', 'childName', 'situation', 'lesson', 'tone', 'ageBand', 'pages', 'choice'] LOOP
    PERFORM hodam_test.expect_commit_error('55555555-5555-4555-8555-555555555555', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', hodam_test.book() - field, 'INVALID_PICTUREBOOK_REQUEST');
    PERFORM hodam_test.expect_commit_error('55555555-5555-4555-8555-555555555555', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', jsonb_set(hodam_test.book(), ARRAY[field], 'null'), 'INVALID_PICTUREBOOK_REQUEST');
  END LOOP;
  FOR bad IN SELECT value FROM (VALUES
    (jsonb_set(hodam_test.book(), '{pages}', '"scalar"')),
    (jsonb_set(hodam_test.book(), '{pages}', '[]')),
    (jsonb_set(hodam_test.book(), '{pages,0}', 'null')),
    (jsonb_set(hodam_test.book(), '{pages,0,pageNumber}', '"1"')),
    (jsonb_set(hodam_test.book(), '{pages,0,pageNumber}', '2')),
    (jsonb_set(hodam_test.book(), '{pages,0,textKo}', 'null')),
    (jsonb_set(hodam_test.book(), '{pages,0,textKo}', '" "')),
    (jsonb_set(hodam_test.book(), '{pages,0,imagePrompt}', 'null')),
    (jsonb_set(hodam_test.book(), '{choice,afterPage}', '"4"')),
    (jsonb_set(hodam_test.book(), '{choice,promptKo}', 'null')),
    (jsonb_set(hodam_test.book(), '{choice,options}', '{}')),
    (jsonb_set(hodam_test.book(), '{choice,options}', '[]')),
    (jsonb_set(hodam_test.book(), '{choice,options,0}', 'null')),
    (jsonb_set(hodam_test.book(), '{choice,options,0,id}', '"B"')),
    (jsonb_set(hodam_test.book(), '{choice,options,0,labelKo}', 'null')),
    (jsonb_set(hodam_test.book(), '{choice,options,0,resolutionHint}', 'null')),
    (jsonb_set(hodam_test.book(), '{title}', to_jsonb(repeat('x', 131073)))),
    (hodam_test.book('Complete input is not a start', 8))
  ) AS invalid(value) LOOP
    PERFORM hodam_test.expect_commit_error('55555555-5555-4555-8555-555555555555', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', bad, 'INVALID_PICTUREBOOK_REQUEST');
  END LOOP;
  PERFORM hodam_test.expect_commit_error('66666666-6666-4666-8666-666666666666', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', hodam_test.book(), 'INSUFFICIENT_BEADS');
  PERFORM hodam_test.expect_commit_error('99999999-9999-4999-8999-999999999999', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', hodam_test.book(), 'BEAD_BALANCE_UNAVAILABLE');
  PERFORM hodam_test.expect_commit_error('88888888-8888-4888-8888-888888888888', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', hodam_test.book(), 'BEAD_BALANCE_UNAVAILABLE');
  PERFORM hodam_test.expect_commit_error('88888888-8888-4888-8888-888888888889', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', hodam_test.book(), 'BEAD_BALANCE_UNAVAILABLE');
  IF (SELECT count(*) FROM public.thread) <> before_threads
     OR (SELECT count(*) FROM public.bead_transactions) <> before_usage
     OR (SELECT sum(count) FROM public.bead) <> before_balance THEN
    RAISE EXCEPTION 'Rejected request changed books or accounting';
  END IF;
END; $$;

-- Historic reservations/refunds have no reliable terminal state: leave them as is.
INSERT INTO public.thread(user_id, openai_thread_id, raw_text) VALUES
  ('77777777-7777-4777-8777-777777777777', 'picturebook_cccccccc-cccc-4ccc-8ccc-cccccccccccc', NULL),
  ('77777777-7777-4777-8777-777777777777', 'picturebook_dddddddd-dddd-4ddd-8ddd-dddddddddddd', '');
INSERT INTO public.bead_transactions(user_id, amount, transaction_type, request_id) VALUES
  ('77777777-7777-4777-8777-777777777777', -1, 'usage', 'picturebook_dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
  ('77777777-7777-4777-8777-777777777777', -1, 'usage', 'picturebook_eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
DO $$ DECLARE request text; BEGIN
  FOREACH request IN ARRAY ARRAY['cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'] LOOP
    PERFORM hodam_test.expect_commit_error('77777777-7777-4777-8777-777777777777', request, hodam_test.book(), 'PICTUREBOOK_REQUEST_UNRESOLVED');
  END LOOP;
  IF (SELECT count FROM public.bead WHERE user_id = '77777777-7777-4777-8777-777777777777') <> 2
     OR (SELECT count(*) FROM public.thread WHERE user_id = '77777777-7777-4777-8777-777777777777') <> 2
     OR EXISTS (SELECT 1 FROM public.thread WHERE user_id = '77777777-7777-4777-8777-777777777777' AND raw_text IS NOT NULL AND raw_text <> '')
     OR (SELECT count(*) FROM public.bead_transactions WHERE user_id = '77777777-7777-4777-8777-777777777777') <> 2 THEN
    RAISE EXCEPTION 'Legacy request was automatically reconciled';
  END IF;
END; $$;

-- Fail after the thread INSERT and balance UPDATE, at ledger INSERT. Every write
-- in both functions must roll back, with no compensating credit call.
CREATE FUNCTION hodam_test.fail_usage() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.request_id = 'picturebook_ffffffff-ffff-4fff-8fff-ffffffffffff' THEN
    RAISE EXCEPTION 'TEST_LEDGER_FAILURE';
  END IF;
  IF NEW.request_id = 'picturebook_ffffffff-ffff-4fff-8fff-fffffffffffe' THEN
    RAISE EXCEPTION 'TEST_LEDGER_UNIQUE_FAILURE' USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER test_usage_failure BEFORE INSERT ON public.bead_transactions
FOR EACH ROW EXECUTE FUNCTION hodam_test.fail_usage();
SELECT hodam_test.expect_commit_error('77777777-7777-4777-8777-777777777777', 'ffffffff-ffff-4fff-8fff-ffffffffffff', hodam_test.book(), 'TEST_LEDGER_FAILURE');
SELECT hodam_test.expect_commit_error('77777777-7777-4777-8777-777777777777', 'ffffffff-ffff-4fff-8fff-fffffffffffe', hodam_test.book(), 'BEAD_BALANCE_UNAVAILABLE');
DO $$ BEGIN
  IF (SELECT count FROM public.bead WHERE user_id = '77777777-7777-4777-8777-777777777777') <> 2
     OR EXISTS (SELECT 1 FROM public.thread WHERE openai_thread_id IN ('picturebook_ffffffff-ffff-4fff-8fff-ffffffffffff', 'picturebook_ffffffff-ffff-4fff-8fff-fffffffffffe'))
     OR EXISTS (SELECT 1 FROM public.bead_transactions WHERE request_id IN ('picturebook_ffffffff-ffff-4fff-8fff-ffffffffffff', 'picturebook_ffffffff-ffff-4fff-8fff-fffffffffffe')) THEN
    RAISE EXCEPTION 'Ledger error left a partial book, debit, or usage record';
  END IF;
END; $$;
DROP TRIGGER test_usage_failure ON public.bead_transactions;
SELECT 'Atomic picturebook assertions passed' AS result;
