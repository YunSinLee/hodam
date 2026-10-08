-- Isolated fixture only. Ownership and grants must hold even when the API is bypassed.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);

DO $$ BEGIN
  PERFORM public.save_reading_feedback(101, 'again', 'story');
  PERFORM public.save_reading_feedback(101, 'again', 'story');
  IF (SELECT count(*) FROM public.reading_feedback WHERE thread_id = 101) <> 1 THEN
    RAISE EXCEPTION 'Repeated feedback created duplicate rows';
  END IF;
  PERFORM public.save_reading_feedback(101, 'disappointed', 'language');
  IF NOT EXISTS (SELECT 1 FROM public.reading_feedback WHERE thread_id = 101 AND rating = 'disappointed' AND reason = 'language') THEN
    RAISE EXCEPTION 'Own feedback could not be updated';
  END IF;
  BEGIN
    PERFORM public.save_reading_feedback(202, 'again', NULL);
    RAISE EXCEPTION 'Feedback could be created on a foreign book';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.save_reading_feedback(101, 'again', 'language');
    RAISE EXCEPTION 'Mismatched reason accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    PERFORM public.save_reading_feedback(101, 'other', NULL);
    RAISE EXCEPTION 'Arbitrary rating accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE public.reading_feedback SET user_id = '22222222-2222-4222-8222-222222222222' WHERE thread_id = 101;
    RAISE EXCEPTION 'Feedback owner could be changed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.reading_feedback SET updated_at = '2000-01-01' WHERE thread_id = 101;
    RAISE EXCEPTION 'Feedback timestamp could be forged';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END; $$;

SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.reading_feedback WHERE thread_id = 101) THEN
    RAISE EXCEPTION 'Foreign feedback visible';
  END IF;
  PERFORM public.save_reading_feedback(202, 'again', NULL);
  UPDATE public.reading_feedback SET rating = 'again', reason = NULL WHERE thread_id = 101;
  IF FOUND THEN RAISE EXCEPTION 'Foreign feedback editable'; END IF;
  BEGIN
    PERFORM public.save_reading_feedback(101, 'again', NULL);
    RAISE EXCEPTION 'Foreign feedback can be overwritten';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END; $$;
RESET ROLE;

SET ROLE anon;
DO $$ BEGIN
  BEGIN
    PERFORM public.save_reading_feedback(101, 'again', NULL);
    RAISE EXCEPTION 'Anonymous feedback write allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM 1 FROM public.reading_feedback;
    RAISE EXCEPTION 'Anonymous feedback read allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END; $$;
RESET ROLE;

DO $$ BEGIN
  IF (SELECT count(*) FROM public.reading_feedback) <> 2 THEN
    RAISE EXCEPTION 'Unexpected feedback rows';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.reading_feedback WHERE thread_id = 101 AND updated_at >= created_at) THEN
    RAISE EXCEPTION 'Feedback update timestamp missing';
  END IF;
END; $$;
SELECT 'Reading feedback RLS, grants, validation and idempotency assertions passed' AS result;
