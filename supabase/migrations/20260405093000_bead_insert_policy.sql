BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bead'
      AND policyname = 'bead_insert_own'
  ) THEN
    CREATE POLICY bead_insert_own ON public.bead
      FOR INSERT TO authenticated
      WITH CHECK ((SELECT auth.uid()) = user_id);
  END IF;
END
$$;

COMMIT;
