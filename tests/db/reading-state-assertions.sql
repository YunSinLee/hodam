SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
DO $$ DECLARE v record; v_before timestamptz; BEGIN
  SELECT * INTO v FROM public.save_reading_state(101, 'favorite', 0, true);
  IF NOT v.applied OR NOT v.favorite OR v.favorite_version <> 1 OR v.progress_version <> 0 OR v.page_index IS NOT NULL THEN
    RAISE EXCEPTION 'First favorite write did not initialize independently';
  END IF;
  SELECT * INTO v FROM public.save_reading_state(101, 'favorite', 0, true);
  IF v.applied OR v.favorite_version <> 1 THEN RAISE EXCEPTION 'Retry overwrote an acknowledged version'; END IF;
  SELECT * INTO v FROM public.save_reading_state(101, 'favorite', 1, false);
  IF NOT v.applied OR v.favorite OR v.favorite_version <> 2 THEN RAISE EXCEPTION 'Favorite update failed'; END IF;
  SELECT * INTO v FROM public.save_reading_state(101, 'progress', 0, NULL, 2, 8, false);
  IF NOT v.applied OR v.page_index <> 2 OR v.progress_version <> 1 OR v.favorite_version <> 2 OR v.progress_updated_at IS NULL THEN
    RAISE EXCEPTION 'Favorite change incorrectly conflicted with independent progress';
  END IF;
  v_before := v.progress_updated_at;
  SELECT * INTO v FROM public.save_reading_state(101, 'favorite', 2, true);
  IF NOT v.applied OR v.favorite_version <> 3 OR v.progress_version <> 1 OR v.progress_updated_at <> v_before THEN
    RAISE EXCEPTION 'Favorite change modified reading progress';
  END IF;
  SELECT * INTO v FROM public.save_reading_state(101, 'progress', 0, NULL, 6, 8, false);
  IF v.applied OR v.page_index <> 2 OR v.progress_version <> 1 THEN RAISE EXCEPTION 'Stale progress overwrote newer state'; END IF;
  SELECT * INTO v FROM public.save_reading_state(101, 'progress', 1, NULL, 2, 8, false);
  IF NOT v.applied OR v.progress_version <> 2 OR v.progress_updated_at < v_before THEN
    RAISE EXCEPTION 'Same-value intent did not advance its version';
  END IF;
  SELECT * INTO v FROM public.save_reading_state(101, 'progress', 2, NULL, 7, 8, true);
  IF NOT v.applied OR NOT v.completed OR v.progress_version <> 3 THEN RAISE EXCEPTION 'Completion save failed'; END IF;
  -- Direct table updates cannot avoid the version triggers.
  UPDATE public.reading_state SET favorite = false WHERE thread_id = 101;
  IF NOT EXISTS (SELECT 1 FROM public.reading_state WHERE thread_id = 101 AND favorite_version = 4 AND progress_version = 3) THEN
    RAISE EXCEPTION 'Direct favorite update bypassed version tracking';
  END IF;
  UPDATE public.reading_state SET page_index = 6, page_count = 8, completed = true WHERE thread_id = 101;
  IF NOT EXISTS (SELECT 1 FROM public.reading_state WHERE thread_id = 101 AND favorite_version = 4 AND progress_version = 4) THEN
    RAISE EXCEPTION 'Direct progress update bypassed version tracking';
  END IF;
  BEGIN
    PERFORM public.save_reading_state(202, 'favorite', 0, true);
    RAISE EXCEPTION 'Foreign book state created';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.save_reading_state(101, 'progress', 4, NULL, 8, 8, false);
    RAISE EXCEPTION 'Out-of-range progress accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'READING_STATE_INVALID' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.save_reading_state(101, 'favorite', 4, true, 1, 8, false);
    RAISE EXCEPTION 'Cross-field payload accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'READING_STATE_INVALID' THEN RAISE; END IF; END;
  BEGIN
    UPDATE public.reading_state SET user_id = '22222222-2222-4222-8222-222222222222' WHERE thread_id = 101;
    RAISE EXCEPTION 'Owner writable';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.reading_state SET thread_id = 202 WHERE thread_id = 101;
    RAISE EXCEPTION 'Book ID writable';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.reading_state SET favorite_version = 0 WHERE thread_id = 101;
    RAISE EXCEPTION 'Favorite version writable';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.reading_state SET progress_version = 0 WHERE thread_id = 101;
    RAISE EXCEPTION 'Progress version writable';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.reading_state SET progress_updated_at = '2000-01-01' WHERE thread_id = 101;
    RAISE EXCEPTION 'Client time writable';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.reading_state(thread_id, favorite) VALUES (101, true);
    RAISE EXCEPTION 'Insert could override protected defaults';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END; $$;

SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
DO $$ DECLARE v record; BEGIN
  IF EXISTS (SELECT 1 FROM public.reading_state WHERE thread_id = 101) THEN RAISE EXCEPTION 'Foreign state visible'; END IF;
  UPDATE public.reading_state SET favorite = true WHERE thread_id = 101;
  IF FOUND THEN RAISE EXCEPTION 'Foreign state editable'; END IF;
  SELECT * INTO v FROM public.save_reading_state(202, 'favorite', 7, true);
  IF v.applied OR v.favorite_version <> 0 OR v.progress_version <> 0 OR v.favorite THEN
    RAISE EXCEPTION 'Nonzero initial version accepted';
  END IF;
  SELECT * INTO v FROM public.save_reading_state(202, 'favorite', 0, false);
  IF NOT v.applied OR v.favorite_version <> 1 THEN RAISE EXCEPTION 'First false intent was not stored'; END IF;
END; $$;
RESET ROLE;
SET ROLE anon;
SELECT set_config('request.jwt.claim.role', 'anon', false);
SELECT set_config('request.jwt.claim.sub', '', false);
DO $$ BEGIN
  BEGIN
    PERFORM public.save_reading_state(101, 'favorite', 0, true);
    RAISE EXCEPTION 'Anonymous state write allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM 1 FROM public.reading_state;
    RAISE EXCEPTION 'Anonymous state read allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END; $$;
RESET ROLE;

BEGIN;
UPDATE public.reading_state SET favorite_version = 2147483646 WHERE thread_id = 101;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
DO $$ BEGIN
  BEGIN
    PERFORM public.save_reading_state(101, 'favorite', 2147483646, true);
    RAISE EXCEPTION 'Exhausted version overflowed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'READING_STATE_VERSION_EXHAUSTED' THEN RAISE; END IF; END;
END; $$;
ROLLBACK;

BEGIN;
DELETE FROM public.thread WHERE id = 101;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.reading_state WHERE thread_id = 101) THEN RAISE EXCEPTION 'Deleted book left reading state behind'; END IF;
END; $$;
ROLLBACK;
SELECT 'Reading state ownership, field CAS, stale retry, protected columns and deletion assertions passed' AS result;
