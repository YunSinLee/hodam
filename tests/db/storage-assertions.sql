DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM storage.buckets WHERE id IN ('image','profiles') AND public) THEN RAISE EXCEPTION 'Private image bucket is public'; END IF;
  IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='profiles') THEN RAISE EXCEPTION 'Missing profile bucket'; END IF;
END; $$;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
DO $$ BEGIN
  IF (SELECT count(*) FROM storage.objects WHERE bucket_id='image') <> 1 THEN RAISE EXCEPTION 'Other user image visible'; END IF;
  INSERT INTO storage.objects VALUES ('image', 'image_thread_id_101_page_2', null);
  BEGIN
    INSERT INTO storage.objects VALUES ('image', 'image_thread_id_202_page_2', null);
    RAISE EXCEPTION 'Other user image writable';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE storage.objects SET metadata='{"changed":true}' WHERE name='image_thread_id_202_page_1';
  IF FOUND THEN RAISE EXCEPTION 'Other user image editable'; END IF;
  DELETE FROM storage.objects WHERE name='image_thread_id_202_page_1';
  IF FOUND THEN RAISE EXCEPTION 'Other user image deletable'; END IF;
  INSERT INTO storage.objects VALUES ('profiles', 'profile_11111111-1111-4111-8111-111111111111_abcd-1234.png', null);
  BEGIN
    INSERT INTO storage.objects VALUES ('profiles', 'profile_22222222-2222-4222-8222-222222222222_abcd-1234.png', null);
    RAISE EXCEPTION 'Other profile writable';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END; $$;
RESET ROLE;
SELECT 'Private storage assertions passed' AS result;
