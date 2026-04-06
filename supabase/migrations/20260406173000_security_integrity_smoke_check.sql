BEGIN;

CREATE OR REPLACE FUNCTION public.hodam_security_integrity_smoke_check()
RETURNS TABLE(check_name text, ok boolean, detail text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN QUERY
  SELECT
    'index_exists.bead_user_id_unique_key' AS check_name,
    EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t
        ON t.oid = c.conrelid
      JOIN pg_namespace n
        ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'bead'
        AND c.contype = 'u'
        AND pg_get_constraintdef(c.oid) = 'UNIQUE (user_id)'
    ) AS ok,
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t
          ON t.oid = c.conrelid
        JOIN pg_namespace n
          ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = 'bead'
          AND c.contype = 'u'
          AND pg_get_constraintdef(c.oid) = 'UNIQUE (user_id)'
      ) THEN 'present'
      ELSE 'missing'
    END AS detail;

  RETURN QUERY
  WITH duplicates AS (
    SELECT user_id, COUNT(*) AS row_count
    FROM public.bead
    GROUP BY user_id
    HAVING COUNT(*) > 1
  )
  SELECT
    'data_integrity.bead_single_row_per_user' AS check_name,
    NOT EXISTS (SELECT 1 FROM duplicates) AS ok,
    format('duplicate_users=%s', (SELECT COUNT(*) FROM duplicates)) AS detail;
END;
$$;

REVOKE ALL ON FUNCTION public.hodam_security_integrity_smoke_check() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hodam_security_integrity_smoke_check() TO authenticated;
GRANT EXECUTE ON FUNCTION public.hodam_security_integrity_smoke_check() TO service_role;

COMMIT;
