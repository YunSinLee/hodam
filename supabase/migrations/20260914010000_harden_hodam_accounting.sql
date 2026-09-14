-- Reviewed against the linked database on 2026-09-14. NOT applied remotely.
-- Deploy with SUPABASE_SERVICE_ROLE_KEY configured on the server and the new
-- payment endpoints. Older browser-side payment implementations will stop working.
BEGIN;

-- Only the server may credit balances or confirm payment after checking Toss.
REVOKE ALL ON FUNCTION public.credit_beads(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_beads(uuid, integer) TO service_role;
REVOKE ALL ON FUNCTION public.finalize_payment(text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_payment(text, text, uuid) TO service_role;

-- Amount, quantity, status, and owner are now created/updated only on the server.
REVOKE INSERT, UPDATE, DELETE ON public.payment_history FROM anon, authenticated;

-- Binding a user id at the application layer is not sufficient for public RPCs.
-- Keep the existing, idempotent implementations and add the same ownership guard
-- to both functions. This preserves their transaction and quota logic.
DO $migration$
DECLARE
  signature regprocedure;
  definition text;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.consume_beads(uuid,integer,text)'::regprocedure,
    'public.consume_daily_quota(uuid,text,integer,integer,jsonb)'::regprocedure
  ] LOOP
    definition := pg_get_functiondef(signature);
    IF position('HODAM_OWNERSHIP_GUARD' IN definition) = 0 THEN
      IF position('BEGIN' IN definition) = 0 THEN
        RAISE EXCEPTION 'Unexpected function definition: %', signature;
      END IF;
      definition := regexp_replace(definition, 'BEGIN', E'BEGIN\n  -- HODAM_OWNERSHIP_GUARD\n  IF COALESCE(auth.role(), '''') <> ''service_role'' AND (auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id) THEN\n    RAISE EXCEPTION ''FORBIDDEN'';\n  END IF;');
      EXECUTE definition;
    END IF;
  END LOOP;
END;
$migration$;
REVOKE ALL ON FUNCTION public.consume_beads(uuid, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.consume_daily_quota(uuid, text, integer, integer, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_beads(uuid, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.consume_daily_quota(uuid, text, integer, integer, jsonb) TO authenticated, service_role;

-- A browser must not choose an arbitrary initial balance.
ALTER POLICY bead_insert_own ON public.bead
  WITH CHECK ((SELECT auth.uid()) = user_id AND count = 10);

-- Concurrent server instances cannot start two books for one idempotency key.
-- This deliberately fails on existing duplicate request ids; investigate those
-- instead of deleting user records automatically.
CREATE UNIQUE INDEX IF NOT EXISTS thread_picturebook_request_unique
  ON public.thread(user_id, openai_thread_id)
  WHERE openai_thread_id LIKE 'picturebook_%';

-- This table already has no anon/authenticated table grants. Add defense in depth.
ALTER TABLE public.payment_webhook_transmissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_webhook_transmissions FROM anon, authenticated;

-- Keep the operational smoke check aligned with the new server-only settlement
-- boundary. Its April version required the authenticated grant revoked above.
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
