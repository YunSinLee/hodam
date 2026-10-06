BEGIN;

-- Deploy this function before the app starts calling it. Legacy creation stays
-- available during rollout; an old empty reservation is never reconciled here.
CREATE OR REPLACE FUNCTION public.commit_picturebook_start(
  p_user_id uuid,
  p_request_id text,
  p_book jsonb
)
RETURNS TABLE(thread_id bigint, raw_text text, bead_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_request_key text;
  v_thread_id bigint;
  v_raw_text text;
  v_balance bigint;
  v_expected_balance bigint;
  v_field text;
  v_page jsonb;
  v_option jsonb;
  v_index integer;
BEGIN
  -- The app verifies the session before passing its user.id. Do not expose a
  -- privileged write API to a browser, even for its own user id.
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF p_user_id IS NULL OR p_request_id IS NULL
     OR p_request_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     OR p_book IS NULL OR jsonb_typeof(p_book) IS DISTINCT FROM 'object'
     OR octet_length(p_book::text) > 131072 THEN
    RAISE EXCEPTION 'INVALID_PICTUREBOOK_REQUEST';
  END IF;
  IF p_book->>'kind' IS DISTINCT FROM 'picturebook'
     OR p_book->>'status' IS DISTINCT FROM 'choice-ready'
     OR jsonb_typeof(p_book->'pages') IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_book->'choice') IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_book->'choice'->'options') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'INVALID_PICTUREBOOK_REQUEST';
  END IF;
  -- The server still validates the complete model contract. This DB boundary
  -- rejects missing/null/scalar payloads before any book or debit can be stored.
  FOREACH v_field IN ARRAY ARRAY['title', 'childName', 'situation', 'lesson'] LOOP
    IF jsonb_typeof(p_book->v_field) IS DISTINCT FROM 'string'
       OR btrim(p_book->>v_field) = '' THEN
      RAISE EXCEPTION 'INVALID_PICTUREBOOK_REQUEST';
    END IF;
  END LOOP;
  IF COALESCE(p_book->>'tone', '') NOT IN ('calm', 'playful', 'brave')
     OR COALESCE(p_book->>'ageBand', '') NOT IN ('3-4', '5-7', '8+')
     OR jsonb_array_length(p_book->'pages') <> 4
     OR p_book->'choice'->'afterPage' IS DISTINCT FROM '4'::jsonb
     OR jsonb_typeof(p_book->'choice'->'promptKo') IS DISTINCT FROM 'string'
     OR btrim(p_book->'choice'->>'promptKo') = ''
     OR jsonb_array_length(p_book->'choice'->'options') <> 3 THEN
    RAISE EXCEPTION 'INVALID_PICTUREBOOK_REQUEST';
  END IF;
  FOR v_index IN 0..3 LOOP
    v_page := p_book->'pages'->v_index;
    IF jsonb_typeof(v_page) IS DISTINCT FROM 'object'
       OR v_page->'pageNumber' IS DISTINCT FROM to_jsonb(v_index + 1)
       OR jsonb_typeof(v_page->'textKo') IS DISTINCT FROM 'string'
       OR btrim(v_page->>'textKo') = ''
       OR jsonb_typeof(v_page->'imagePrompt') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'INVALID_PICTUREBOOK_REQUEST';
    END IF;
  END LOOP;
  FOR v_index IN 0..2 LOOP
    v_option := p_book->'choice'->'options'->v_index;
    IF jsonb_typeof(v_option) IS DISTINCT FROM 'object'
       OR v_option->>'id' IS DISTINCT FROM (ARRAY['A', 'B', 'C'])[v_index + 1]
       OR jsonb_typeof(v_option->'labelKo') IS DISTINCT FROM 'string'
       OR btrim(v_option->>'labelKo') = ''
       OR jsonb_typeof(v_option->'resolutionHint') IS DISTINCT FROM 'string'
       OR btrim(v_option->>'resolutionHint') = '' THEN
      RAISE EXCEPTION 'INVALID_PICTUREBOOK_REQUEST';
    END IF;
  END LOOP;

  -- Preserve the legacy UUID spelling so existing recovery keys still resolve.
  v_request_key := 'picturebook_' || p_request_id;
  PERFORM pg_advisory_xact_lock(hashtext('picturebook:' || p_user_id::text), hashtext(p_request_id));

  -- Also serialize with the existing debit/payment functions, which update this
  -- row without taking the new request lock. Check the ledger only after this.
  SELECT b.count INTO v_balance FROM public.bead b
    WHERE b.user_id = p_user_id FOR UPDATE;
  IF NOT FOUND OR v_balance IS NULL OR v_balance < 0 OR v_balance > 2147483647 THEN
    RAISE EXCEPTION 'BEAD_BALANCE_UNAVAILABLE';
  END IF;

  SELECT t.id, t.raw_text INTO v_thread_id, v_raw_text FROM public.thread t
    WHERE t.user_id = p_user_id AND t.openai_thread_id = v_request_key
    FOR UPDATE;
  IF FOUND THEN
    IF v_raw_text IS NULL OR btrim(v_raw_text) = '' THEN
      RAISE EXCEPTION 'PICTUREBOOK_REQUEST_UNRESOLVED';
    END IF;
    -- A completed ending and legacy saved books are returned unchanged, even
    -- with a zero balance. The app validates the returned saved-book contract.
    RETURN QUERY SELECT v_thread_id, v_raw_text, v_balance::integer;
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.bead_transactions bt
    WHERE bt.user_id = p_user_id AND bt.request_id = v_request_key
  ) THEN
    -- A deleted book or an old interrupted/refunded request cannot be inferred
    -- from the usage row: legacy refunds did not record their request identity.
    RAISE EXCEPTION 'PICTUREBOOK_REQUEST_UNRESOLVED';
  END IF;

  INSERT INTO public.thread(user_id, openai_thread_id, able_english, has_image, raw_text)
    VALUES (p_user_id, v_request_key, false, false, p_book::text)
    ON CONFLICT (user_id, openai_thread_id)
      WHERE openai_thread_id LIKE 'picturebook_%'
      DO NOTHING
    RETURNING id INTO v_thread_id;
  IF NOT FOUND THEN
    -- An older app worker does not take our advisory lock. It can win this
    -- unique-key race; reuse a saved book, or leave its reservation untouched.
    SELECT t.id, t.raw_text INTO v_thread_id, v_raw_text FROM public.thread t
      WHERE t.user_id = p_user_id AND t.openai_thread_id = v_request_key
      FOR UPDATE;
    IF NOT FOUND OR v_raw_text IS NULL OR btrim(v_raw_text) = '' THEN
      RAISE EXCEPTION 'PICTUREBOOK_REQUEST_UNRESOLVED';
    END IF;
    RETURN QUERY SELECT v_thread_id, v_raw_text, v_balance::integer;
    RETURN;
  END IF;

  -- A propagated error rolls back both this INSERT and consume_beads' balance
  -- and ledger writes. There is no separately committed reservation or refund.
  v_expected_balance := v_balance - 1;
  v_balance := public.consume_beads(p_user_id, 1, v_request_key);
  -- The legacy RPC catches unique_violation internally. Require actual debit
  -- evidence too, so a swallowed ledger failure cannot commit an unpaid book.
  IF v_balance IS NULL OR v_balance < 0 OR v_balance > 2147483647
     OR v_balance IS DISTINCT FROM v_expected_balance
     OR NOT EXISTS (SELECT 1 FROM public.bead b WHERE b.user_id = p_user_id AND b.count = v_balance)
     OR NOT EXISTS (SELECT 1 FROM public.bead_transactions bt
       WHERE bt.user_id = p_user_id AND bt.request_id = v_request_key
         AND bt.transaction_type = 'usage' AND bt.amount = -1) THEN
    RAISE EXCEPTION 'BEAD_BALANCE_UNAVAILABLE';
  END IF;
  RETURN QUERY SELECT v_thread_id, p_book::text, v_balance::integer;
END;
$function$;

REVOKE ALL ON FUNCTION public.commit_picturebook_start(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commit_picturebook_start(uuid, text, jsonb) TO service_role;

-- Cheap read-only preflight: fail before model usage when the migration or the
-- service credential is unavailable. Do not substitute a browser user client.
CREATE OR REPLACE FUNCTION public.picturebook_storage_ready()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_commit_function regprocedure;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  v_commit_function := to_regprocedure('public.commit_picturebook_start(uuid,text,jsonb)');
  IF v_commit_function IS NULL THEN RETURN false; END IF;
  RETURN has_function_privilege('service_role', v_commit_function, 'EXECUTE');
END;
$function$;
REVOKE ALL ON FUNCTION public.picturebook_storage_ready() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.picturebook_storage_ready() TO service_role;

-- Add the new boundary to the existing read-only operational grant report.
CREATE OR REPLACE FUNCTION public.hodam_security_grants_smoke_check()
RETURNS TABLE(check_name text, ok boolean, detail text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $check$
  WITH functions(signature, client_allowed) AS (
    VALUES
      ('public.consume_beads(uuid,integer,text)', true),
      ('public.consume_daily_quota(uuid,text,integer,integer,jsonb)', true),
      ('public.credit_beads(uuid,integer)', false),
      ('public.finalize_payment(text,text,uuid)', false),
      ('public.commit_picturebook_start(uuid,text,jsonb)', false),
      ('public.picturebook_storage_ready()', false),
      ('public.get_my_threads()', true),
      ('public.get_thread_detail(bigint)', true)
  ), expected AS (
    SELECT signature, role_name,
      role_name = 'service_role' OR (role_name = 'authenticated' AND client_allowed) AS allowed
    FROM functions CROSS JOIN (VALUES ('anon'), ('authenticated'), ('service_role')) roles(role_name)
  )
  SELECT
    'function_execute_' || CASE WHEN allowed THEN 'allow_' ELSE 'deny_' END || role_name || '.' || split_part(substr(signature, 8), '(', 1),
    has_function_privilege(role_name, signature, 'EXECUTE') = allowed,
    CASE WHEN has_function_privilege(role_name, signature, 'EXECUTE') THEN 'granted' ELSE 'blocked' END
  FROM expected
  UNION ALL
  SELECT
    'table_write_deny_' || role_name || '.payment_history.' || lower(privilege),
    NOT has_table_privilege(role_name, 'public.payment_history', privilege),
    CASE WHEN has_table_privilege(role_name, 'public.payment_history', privilege) THEN 'granted' ELSE 'blocked' END
  FROM (VALUES ('anon'), ('authenticated')) roles(role_name)
  CROSS JOIN (VALUES ('INSERT'), ('UPDATE'), ('DELETE')) privileges(privilege);
$check$;
REVOKE ALL ON FUNCTION public.hodam_security_grants_smoke_check() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hodam_security_grants_smoke_check() TO authenticated, service_role;

COMMIT;
