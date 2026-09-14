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
COMMIT;
